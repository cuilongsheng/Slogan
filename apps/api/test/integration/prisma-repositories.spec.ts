import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AUTH_REPOSITORY, type AuthRepository } from '../../src/modules/auth/index.js';
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
  ProfilesService,
} from '../../src/modules/profiles/index.js';

describe('Prisma identity, session and profile repositories', () => {
  const now = new Date('2026-09-10T00:00:00.000Z');
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let auth: AuthRepository;
  let profiles: ProfileRepository;
  let profileService: ProfilesService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get<AuthRepository>(AUTH_REPOSITORY);
    profiles = moduleRef.get<ProfileRepository>(PROFILE_REPOSITORY);
    profileService = moduleRef.get(ProfilesService);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.roomMembership.deleteMany();
    await prisma.roomEvent.deleteMany({ where: { reportId: { not: null } } });
    await prisma.report.deleteMany();
    await prisma.room.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.accountLifecycleCommand.deleteMany();
    await prisma.phoneIdentity.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.oAuthIdentity.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => moduleRef.close());

  it('applies the expected tables, foreign keys and unique identity index', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const constraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
    `;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;

    expect(tables.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([
        'User',
        'OAuthIdentity',
        'AuthSession',
        'RefreshToken',
        'UserProfile',
        'PhoneIdentity',
        'AccountLifecycleCommand',
      ]),
    );
    expect(constraints.map(({ constraint_name }) => constraint_name)).toEqual(
      expect.arrayContaining([
        'OAuthIdentity_userId_fkey',
        'AuthSession_userId_fkey',
        'RefreshToken_sessionId_fkey',
        'UserProfile_userId_fkey',
      ]),
    );
    expect(indexes.map(({ indexname }) => indexname)).toContain('OAuthIdentity_issuer_subject_key');
    expect(indexes.map(({ indexname }) => indexname)).toContain(
      'PhoneIdentity_phoneLookupVersion_phoneLookupHash_key',
    );
  });

  it('converges concurrent identity creation on one user', async () => {
    const identity = {
      provider: 'GOOGLE' as const,
      issuer: 'https://accounts.google.com',
      subject: 'concurrent-subject',
    };

    const results = await Promise.all(
      Array.from({ length: 6 }, () => auth.findOrCreateUser(identity, now)),
    );

    expect(new Set(results.map(({ userId }) => userId)).size).toBe(1);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.oAuthIdentity.count()).toBe(1);
  });

  it('rolls back a nested session write when the refresh digest conflicts', async () => {
    const userId = randomUUID();
    await prisma.user.create({ data: { id: userId, createdAt: now, updatedAt: now } });
    const expiresAt = new Date('2026-10-10T00:00:00.000Z');
    const input = { userId, digest: 'a'.repeat(64), expiresAt, now };

    await auth.createSession(input);
    await expect(auth.createSession(input)).rejects.toMatchObject({ code: 'P2002' });

    expect(await prisma.authSession.count()).toBe(1);
    expect(await prisma.refreshToken.count()).toBe(1);
  });

  it('converges phone registration and rejects cross-account identity linking', async () => {
    const phone = {
      lookupVersion: 'v1',
      lookupHash: '9'.repeat(64),
      countryCallingCode: '86',
      lastTwo: '00',
      region: 'CN',
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => auth.findOrCreatePhoneUser(phone, now)),
    );
    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    expect(await prisma.phoneIdentity.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);

    const other = randomUUID();
    await prisma.user.create({ data: { id: other, createdAt: now, updatedAt: now } });
    await expect(auth.linkPhoneIdentity(other, phone, now)).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_ALREADY_BOUND',
    });
    const oauth = {
      provider: 'GOOGLE' as const,
      issuer: 'https://accounts.google.com',
      subject: 'already-owned',
    };
    await auth.linkOAuthIdentity(results[0]!.userId, oauth, now);
    await expect(auth.linkOAuthIdentity(other, oauth, now)).rejects.toMatchObject({
      code: 'AUTH_IDENTITY_ALREADY_BOUND',
    });
    expect(await auth.listLoginMethods(results[0]!.userId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'PHONE', mask: '+86••00' }),
        expect.objectContaining({ type: 'GOOGLE' }),
      ]),
    );
  });

  it('refuses OAuth, phone and new sessions for disabled or deleted identities', async () => {
    const identity = {
      provider: 'GOOGLE' as const,
      issuer: 'https://accounts.google.com',
      subject: 'disabled-subject',
    };
    const account = await auth.findOrCreateUser(identity, now);
    await prisma.user.update({ where: { id: account.userId }, data: { status: 'DISABLED' } });
    await expect(auth.findOrCreateUser(identity, now)).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_UNAVAILABLE',
    });
    await expect(
      auth.createSession({
        userId: account.userId,
        digest: 'e'.repeat(64),
        expiresAt: new Date(now.getTime() + 3600_000),
        now,
      }),
    ).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_UNAVAILABLE' });
  });

  it('allows one refresh rotation and revokes the session on concurrent replay', async () => {
    const userId = randomUUID();
    await prisma.user.create({ data: { id: userId, createdAt: now, updatedAt: now } });
    const expiresAt = new Date('2026-10-10T00:00:00.000Z');
    const { sessionId } = await auth.createSession({
      userId,
      digest: 'b'.repeat(64),
      expiresAt,
      now,
    });

    const results = await Promise.allSettled([
      auth.rotateRefreshToken({
        digest: 'b'.repeat(64),
        nextDigest: 'c'.repeat(64),
        nextExpiresAt: expiresAt,
        now,
      }),
      auth.rotateRefreshToken({
        digest: 'b'.repeat(64),
        nextDigest: 'd'.repeat(64),
        nextExpiresAt: expiresAt,
        now,
      }),
    ]);
    const statuses = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value.status] : [],
    );

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    expect(statuses.sort()).toEqual(['REUSED', 'ROTATED']);
    expect(await auth.isSessionActive(userId, sessionId, now)).toBe(false);
  });

  it('upserts only the current user profile and persists changed birth data idempotently', async () => {
    const userId = randomUUID();
    await prisma.user.create({ data: { id: userId, createdAt: now, updatedAt: now } });
    const baseProfile = {
      avatarUrl: 'https://example.com/avatar.png',
      displayName: 'Repository User',
      genderCode: 'prefer_not_to_say' as const,
      nationalityCode: 'CN',
      interestCodes: ['backend'],
      cefrLevel: 'B1' as const,
      birthYear: 2000,
      birthMonth: 1,
    };

    await profileService.put(userId, { ...baseProfile, birthYear: 2009, birthMonth: 10 }, now);
    expect(await profileService.getOnboardingState(userId, now)).toBe('AGE_RESTRICTED');
    await profileService.put(userId, { ...baseProfile, birthMonth: 2 }, now);

    expect(await profiles.findByUserId(userId)).toMatchObject({ birthYear: 2000, birthMonth: 2 });
    expect(await profileService.getOnboardingState(userId, now)).toBe('ELIGIBLE');
    expect(await prisma.userProfile.count()).toBe(1);
    await expect(profiles.findByUserId(randomUUID())).resolves.toBeNull();
  });
});
