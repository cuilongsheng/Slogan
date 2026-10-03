import { PrismaAccountLifecycleRepository } from '../../src/modules/account-lifecycle/testing.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PrismaEmailAuthRepository } from '../../src/modules/auth/testing.js';
import { PrismaEmailDeliveryRepository } from '../../src/modules/auth/testing.js';
import { PrismaAuthRepository } from '../../src/modules/auth/testing.js';
import { EmailSecurityAdapter } from '../../src/modules/auth/testing.js';
import { emailConfig } from '../fixtures/email-auth.js';
import { clearRealtimeFixtures } from '../fixtures/realtime.js';

describe('email authentication PostgreSQL transactions', () => {
  const prisma = new PrismaService(emailConfig());
  const auth = new PrismaEmailAuthRepository(prisma);
  const sessions = new PrismaAuthRepository(prisma);
  const deliveries = new PrismaEmailDeliveryRepository(prisma);
  const security = new EmailSecurityAdapter(emailConfig());
  const now = new Date();
  function challenge(
    email = 'fixture@example.test',
    purpose: 'REGISTER' | 'LINK' | 'RESET_PASSWORD' = 'REGISTER',
  ) {
    const token = security.newToken(),
      deliveryId = randomUUID();
    return {
      token,
      input: {
        id: randomUUID(),
        deliveryId,
        tokenDigest: security.digest(token),
        ...security.encrypt(deliveryId, { to: email, token, purpose }),
      },
    };
  }
  async function enroll(username = 'fixture_user', email = 'fixture@example.test') {
    const c = challenge(email),
      managementToken = security.newToken();
    const row = await auth.enroll({
      id: randomUUID(),
      username,
      email,
      passwordHash: 'fixture-hash',
      managementDigest: security.digest(managementToken),
      challenge: c.input,
      now,
    });
    return { row, token: c.token, managementToken };
  }
  async function verified() {
    const e = await enroll();
    await auth.confirm(security.digests(e.token), 'REGISTER', now);
    return (await auth.credential('fixture_user'))!;
  }
  beforeEach(() => clearRealtimeFixtures(prisma));
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await prisma.$disconnect();
  });
  it('never creates a user/session before verification, caps pending and preserves previous password', async () => {
    const first = await enroll();
    await enroll();
    await enroll();
    await expect(enroll()).rejects.toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.authSession.count()).toBe(0);
    expect(
      (await auth.findEnrollment(security.digests(first.managementToken), now))?.passwordHash,
    ).toBe('fixture-hash');
    expect(first.row.expiresAt.getTime() - now.getTime()).toBe(86400000);
    expect(
      await auth.findEnrollment(security.digests(first.managementToken), first.row.expiresAt),
    ).toBeNull();
  });
  it('resend enforces 60 seconds, replaces generation and preserves fixed enrollment expiry', async () => {
    const e = await enroll(),
      c = challenge();
    await expect(
      auth.resend(e.row.id, c.input, new Date(now.getTime() + 59999)),
    ).rejects.toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
    await auth.resend(e.row.id, c.input, new Date(now.getTime() + 60000));
    expect(
      (await prisma.emailEnrollment.findUniqueOrThrow({ where: { id: e.row.id } })).expiresAt,
    ).toEqual(e.row.expiresAt);
    await expect(
      auth.confirm(security.digests(e.token), 'REGISTER', new Date(now.getTime() + 60001)),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    await auth.confirm(security.digests(c.token), 'REGISTER', new Date(now.getTime() + 60001));
  });
  it('unique identity competition rolls back losing users and one token only commits once', async () => {
    const [a, b] = await Promise.all([enroll(), enroll()]);
    const results = await Promise.allSettled([
      auth.confirm(security.digests(a.token), 'REGISTER', now),
      auth.confirm(security.digests(b.token), 'REGISTER', now),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.emailCredential.count()).toBe(1);
    const replay = await Promise.allSettled([
      auth.confirm(security.digests(a.token), 'REGISTER', now),
      auth.confirm(security.digests(b.token), 'REGISTER', now),
    ]);
    expect(replay.every((r) => r.status === 'rejected')).toBe(true);
    const completed = await prisma.emailEnrollment.findFirstOrThrow({
      where: { completedAt: { not: null } },
    });
    expect(completed).toMatchObject({
      passwordHash: null,
      managementDigest: null,
      email: null,
      username: null,
    });
  });
  it('rejects wrong purpose and expiry without consuming challenges', async () => {
    const e = await enroll();
    await expect(auth.confirm(security.digests(e.token), 'LINK', now)).rejects.toMatchObject({
      code: 'EMAIL_TOKEN_INVALID',
    });
    await expect(
      auth.confirm(security.digests(e.token), 'REGISTER', new Date(now.getTime() + 1800000)),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    expect((await prisma.emailChallenge.findFirstOrThrow()).consumedAt).toBeNull();
  });
  it('resets once, revokes every session and rejects a late old-password session commit', async () => {
    const user = await verified();
    const old = await sessions.createSession({
      userId: user.userId,
      credentialVersion: 1,
      digest: randomUUID(),
      expiresAt: new Date(now.getTime() + 86400000),
      now,
    });
    const c = challenge(user.email, 'RESET_PASSWORD');
    await auth.requestReset(user.email, c.input, now);
    const results = await Promise.allSettled([
      auth.reset(security.digests(c.token), 'new-hash', now),
      auth.reset(security.digests(c.token), 'different-hash', now),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sessions.isSessionActive(user.userId, old.sessionId, now)).toBe(false);
    await expect(
      sessions.createSession({
        userId: user.userId,
        credentialVersion: 1,
        digest: randomUUID(),
        expiresAt: new Date(now.getTime() + 86400000),
        now,
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_CREDENTIALS_INVALID' });
    const current = await auth.credential(user.username);
    expect(current?.credentialVersion).toBe(2);
    expect(await prisma.authSession.count({ where: { revokedAt: null } })).toBe(0);
  });
  it('serializes reset with refresh and old login so neither leaves an active old session', async () => {
    const user = await verified(),
      digest = randomUUID();
    await sessions.createSession({
      userId: user.userId,
      credentialVersion: 1,
      digest,
      expiresAt: new Date(now.getTime() + 86400000),
      now,
    });
    const c = challenge(user.email, 'RESET_PASSWORD');
    await auth.requestReset(user.email, c.input, now);
    await Promise.allSettled([
      auth.reset(security.digests(c.token), 'new-hash', now),
      sessions.rotateRefreshToken({
        digest,
        nextDigest: randomUUID(),
        nextExpiresAt: new Date(now.getTime() + 86400000),
        now,
      }),
      sessions.createSession({
        userId: user.userId,
        credentialVersion: 1,
        digest: randomUUID(),
        expiresAt: new Date(now.getTime() + 86400000),
        now,
      }),
    ]);
    expect((await auth.credential(user.username))?.credentialVersion).toBe(2);
    expect(await prisma.authSession.count({ where: { revokedAt: null } })).toBe(0);
  });
  it('unknown, disabled and deleted reset recipients create no delivery', async () => {
    await auth.requestReset('unknown@example.test', challenge().input, now);
    expect(await prisma.emailDelivery.count()).toBe(0);
    const user = await verified();
    const before = await prisma.emailDelivery.count();
    for (const status of ['DISABLED', 'DELETED'] as const) {
      await prisma.user.update({ where: { id: user.userId }, data: { status } });
      await auth.requestReset(user.email, challenge().input, now);
    }
    expect(await prisma.emailDelivery.count()).toBe(before);
  });
  it('cleans temporary content immediately at expiry and removes metadata after seven days', async () => {
    const retained = await verified();
    const e = await enroll('other_user', 'other@example.test');
    await deliveries.cleanup(new Date(now.getTime() + 86400001));
    expect(
      (await prisma.emailEnrollment.findUniqueOrThrow({ where: { id: e.row.id } })).passwordHash,
    ).toBeNull();
    expect(await prisma.emailDelivery.count({ where: { encryptedPayload: { not: null } } })).toBe(
      0,
    );
    await deliveries.cleanup(new Date(now.getTime() + 9 * 86400000));
    expect(await prisma.emailEnrollment.count()).toBe(0);
    expect(await prisma.emailChallenge.count()).toBe(0);
    expect(await auth.credentialForUser(retained.userId)).not.toBeNull();
  });
  it('binds proofs to user, session, command, purpose and five-minute lifetime', async () => {
    const userId = randomUUID();
    await prisma.user.create({ data: { id: userId } });
    const session = await sessions.createSession({
      userId,
      digest: randomUUID(),
      expiresAt: new Date(now.getTime() + 86400000),
      now,
    });
    const commandId = randomUUID(),
      proof = security.newToken();
    await auth.createProof({
      id: randomUUID(),
      userId,
      sessionId: session.sessionId,
      commandId,
      purpose: 'LINK_EMAIL',
      tokenDigest: security.digest(proof),
      now,
    });
    const c = challenge('bound@example.test', 'LINK');
    const input = {
      id: randomUUID(),
      username: 'bound_user',
      email: 'bound@example.test',
      passwordHash: 'fixture',
      managementDigest: security.digest(security.newToken()),
      challenge: c.input,
      now,
      link: {
        userId,
        sessionId: session.sessionId,
        commandId,
        payloadHash: 'a'.repeat(64),
        proofDigests: security.digests(proof),
      },
    };
    await expect(
      auth.enroll({ ...input, link: { ...input.link, commandId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    const other = await sessions.createSession({
      userId,
      digest: randomUUID(),
      expiresAt: new Date(now.getTime() + 86400000),
      now,
    });
    await expect(
      auth.enroll({ ...input, link: { ...input.link, sessionId: other.sessionId } }),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    await expect(
      auth.enroll({ ...input, now: new Date(now.getTime() + 300000) }),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    await prisma.emailAuthProof.updateMany({ data: { purpose: 'ACCOUNT_DELETE' } });
    await expect(auth.enroll(input)).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    await prisma.emailAuthProof.updateMany({ data: { purpose: 'LINK_EMAIL' } });
    await auth.enroll(input);
    await auth.confirm(security.digests(c.token), 'LINK', now, {
      userId,
      sessionId: session.sessionId,
    });
    expect((await auth.credential('bound_user'))?.userId).toBe(userId);
    expect(await prisma.user.count()).toBe(1);
    await expect(auth.enroll(input)).rejects.toMatchObject({ code: 'EMAIL_COMMAND_CONFLICT' });
  });
  it('reset invalidates password deletion proof; expiry and wrong commands cannot delete', async () => {
    const user = await verified();
    const session = await sessions.createSession({
      userId: user.userId,
      digest: randomUUID(),
      expiresAt: new Date(now.getTime() + 86400000),
      now,
    });
    const proof = security.newToken(),
      commandId = randomUUID();
    await auth.createProof({
      id: randomUUID(),
      userId: user.userId,
      sessionId: session.sessionId,
      commandId,
      purpose: 'ACCOUNT_DELETE',
      tokenDigest: security.digest(proof),
      credentialVersion: 1,
      now,
    });
    const deletion = new PrismaAccountLifecycleRepository(prisma);
    const input = {
      userId: user.userId,
      sessionId: session.sessionId,
      clientRequestId: commandId,
      payloadHash: 'b'.repeat(64),
      emailProofDigests: security.digests(proof),
      now,
    };
    await expect(
      deletion.deleteAccount({ ...input, clientRequestId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    await expect(
      deletion.deleteAccount({ ...input, now: new Date(now.getTime() + 300000) }),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })).status).toBe(
      'ACTIVE',
    );
    const c = challenge(user.email, 'RESET_PASSWORD');
    await auth.requestReset(user.email, c.input, now);
    await auth.reset(security.digests(c.token), 'new-password-hash', now);
    await expect(deletion.deleteAccount(input)).rejects.toMatchObject({
      code: 'EMAIL_TOKEN_INVALID',
    });
    expect((await auth.credentialForUser(user.userId))?.active).toBe(true);
  });
  it('deletion consumes proof atomically, replays the command and retains identity occupancy', async () => {
    const user = await verified();
    const session = await sessions.createSession({
      userId: user.userId,
      digest: randomUUID(),
      expiresAt: new Date(now.getTime() + 86400000),
      now,
    });
    const proof = security.newToken(),
      commandId = randomUUID();
    await auth.createProof({
      id: randomUUID(),
      userId: user.userId,
      sessionId: session.sessionId,
      commandId,
      purpose: 'ACCOUNT_DELETE',
      tokenDigest: security.digest(proof),
      credentialVersion: 1,
      now,
    });
    const c = challenge(user.email, 'RESET_PASSWORD');
    await auth.requestReset(user.email, c.input, now);
    const deletion = new PrismaAccountLifecycleRepository(prisma);
    const input = {
      userId: user.userId,
      sessionId: session.sessionId,
      clientRequestId: commandId,
      payloadHash: 'b'.repeat(64),
      emailProofDigests: security.digests(proof),
      now,
    };
    const result = await deletion.deleteAccount(input);
    expect(result.status).toBe('DELETED');
    expect(await deletion.deleteAccount(input)).toEqual(result);
    expect(await prisma.emailDelivery.count({ where: { encryptedPayload: { not: null } } })).toBe(
      0,
    );
    await expect(auth.reset(security.digests(c.token), 'cannot-revive', now)).rejects.toMatchObject(
      { code: 'EMAIL_TOKEN_INVALID' },
    );
    await expect(enroll()).rejects.toMatchObject({ code: 'EMAIL_USERNAME_TAKEN' });
    expect((await auth.credentialForUser(user.userId))?.passwordHash).toBeNull();
  });
});
