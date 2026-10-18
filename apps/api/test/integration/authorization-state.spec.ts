import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../src/config/environment.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PrismaAuthRepository, previewUserAllowed } from '../../src/modules/auth/testing.js';
import { testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

test('narrow authorization preserves credential-scope policy, including trial mappings and mutable session state', async () => {
  const environment = testEnvironment({
    PREVIEW_ACCOUNTS_ENABLED: true,
    EMAIL_PASSWORD_AUTH_ENABLED: true,
    PREVIEW_ENVIRONMENT_ID: 'scope-test',
  });
  const config = new ConfigService<Environment, true>(environment),
    prisma = new PrismaService(config),
    repository = new PrismaAuthRepository(prisma, config);
  try {
    await prisma.publicTrialAccount.deleteMany();
    await clearRealtimeFixtures(prisma);
    for (const mode of ['ordinary', 'preview', 'trial', 'verified-trial'] as const) {
      const user = await seedAdult(prisma, `Scope ${mode}`),
        now = new Date(),
        sessionId = randomUUID();
      await prisma.authSession.create({
        data: { id: sessionId, userId: user.id, expiresAt: new Date(now.getTime() + 3600000) },
      });
      if (mode !== 'ordinary')
        await prisma.emailCredential.create({
          data: {
            userId: user.id,
            username: mode === 'preview' ? 'scope_member' : `scope_${mode.replace('-', '')}`,
            email: `${randomUUID()}@fixture.invalid`,
            passwordHash: 'fixture-hash',
            origin: mode === 'preview' ? 'PREVIEW_PROVISIONED' : 'PUBLIC_TRIAL_PROVISIONED',
            verifiedAt: null,
          },
        });
      if (mode === 'preview')
        await prisma.previewAccountProvisioning.create({
          data: {
            userId: user.id,
            environmentId: 'scope-test',
            slot: 'MOBILE_A',
            batchId: randomUUID(),
            grantCommandId: randomUUID(),
            revokeCommandId: randomUUID(),
          },
        });
      if (mode === 'trial' || mode === 'verified-trial')
        await prisma.publicTrialAccount.create({
          data: {
            userId: user.id,
            environmentId: 'scope-test',
            username: mode === 'trial' ? 'demo_m1' : 'demo_m2',
          },
        });
      if (mode === 'verified-trial')
        await prisma.emailCredential.update({
          where: { userId: user.id },
          data: { origin: 'EMAIL_VERIFIED', verifiedAt: now },
        });
      const full = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { emailCredential: true, previewAccount: true, publicTrialAccount: true },
      });
      for (const scope of [
        config,
        new ConfigService<Environment, true>({ ...environment, PREVIEW_ENVIRONMENT_ID: 'other' }),
        new ConfigService<Environment, true>({ ...environment, PREVIEW_ACCOUNTS_ENABLED: false }),
      ]) {
        const state = await new PrismaAuthRepository(prisma, scope).authorizationState(
          user.id,
          sessionId,
          now,
        );
        expect(state.active).toBe(previewUserAllowed(full, scope));
        expect(state.trial).toBe(mode === 'trial');
      }
      const current = await repository.authorizationState(user.id, sessionId, now);
      expect(current.eligible).toBe(true);
      await prisma.authSession.update({ where: { id: sessionId }, data: { revokedAt: now } });
      expect((await repository.authorizationState(user.id, sessionId, now)).active).toBe(false);
    }
  } finally {
    await prisma.publicTrialAccount.deleteMany();
    await clearRealtimeFixtures(prisma);
    await prisma.$disconnect();
  }
});
