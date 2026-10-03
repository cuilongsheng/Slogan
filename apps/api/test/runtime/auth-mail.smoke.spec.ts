import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PrismaEmailAuthRepository } from '../../src/modules/auth/testing.js';
import { PrismaEmailDeliveryRepository } from '../../src/modules/auth/testing.js';
import { EmailSecurityAdapter } from '../../src/modules/auth/testing.js';
import { SmtpMailSender } from '../../src/modules/auth/testing.js';
import { AuthMailService } from '../../src/modules/auth/testing.js';
import { emailConfig, emailEnvironment } from '../fixtures/email-auth.js';
import { smtpFixture } from '../fixtures/smtp.js';
import { clearRealtimeFixtures } from '../fixtures/realtime.js';

describe('auth mail worker with PostgreSQL and local SMTP', () => {
  const prisma = new PrismaService(emailConfig());
  const auth = new PrismaEmailAuthRepository(prisma);
  const deliveries = new PrismaEmailDeliveryRepository(prisma);
  const security = new EmailSecurityAdapter(emailConfig());
  let smtp: Awaited<ReturnType<typeof smtpFixture>>;
  let worker: AuthMailService;
  beforeAll(async () => {
    smtp = await smtpFixture();
    const config = emailConfig({ EMAIL_SMTP_PORT: smtp.port, EMAIL_SMTP_TIMEOUT_MS: 500 });
    worker = new AuthMailService(deliveries, security, new SmtpMailSender(config), config);
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    smtp.messages.length = 0;
    smtp.setMode('accept');
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await prisma.$disconnect();
    await smtp.close();
  });
  async function enroll() {
    const token = security.newToken(),
      deliveryId = randomUUID(),
      now = new Date();
    await auth.enroll({
      id: randomUUID(),
      username: 'mail_fixture',
      email: 'mail@example.test',
      passwordHash: 'fixture',
      managementDigest: security.digest(security.newToken()),
      now,
      challenge: {
        id: randomUUID(),
        deliveryId,
        tokenDigest: security.digest(token),
        ...security.encrypt(deliveryId, { to: 'mail@example.test', token, purpose: 'REGISTER' }),
      },
    });
    return { token, deliveryId };
  }
  it('sends a fragment-only link with a stable Message-ID and immediately clears payload', async () => {
    const e = await enroll();
    expect(await worker.tick()).toBe(1);
    expect(smtp.messages).toHaveLength(1);
    const message = smtp.messages[0]!.replace(/=\r\n/g, '').replace(
      /=([A-F0-9]{2})/g,
      (_, hex: string) => String.fromCharCode(parseInt(hex, 16)),
    );
    expect(message).toContain('#token=' + e.token);
    expect(message).not.toContain('?token=');
    expect(message).toContain(`<${e.deliveryId}@slogan-auth.invalid>`);
    expect(
      await prisma.emailDelivery.findUniqueOrThrow({ where: { id: e.deliveryId } }),
    ).toMatchObject({ status: 'DELIVERED', encryptedPayload: null, attempts: 1 });
    expect(await prisma.emailCredential.count()).toBe(0);
  });
  it.each(['reject', 'timeout'] as const)(
    'persists %s and stops after five attempts',
    async (mode) => {
      smtp.setMode(mode);
      const e = await enroll();
      for (let i = 0; i < 5; i++) {
        await prisma.emailDelivery.update({
          where: { id: e.deliveryId },
          data: { nextAttemptAt: new Date(0) },
        });
        expect(await worker.tick()).toBe(1);
      }
      expect(await worker.tick()).toBe(0);
      expect(
        await prisma.emailDelivery.findUniqueOrThrow({ where: { id: e.deliveryId } }),
      ).toMatchObject({
        status: 'FAILED',
        attempts: 5,
        encryptedPayload: null,
        resultCode: mode === 'reject' ? 'REJECTED' : 'UNCERTAIN',
      });
    },
    15000,
  );
  it('recovers expired leases, fences old worker completion and keeps single-use verification', async () => {
    const e = await enroll(),
      now = new Date();
    const old = (await deliveries.claim(now))[0]!;
    await prisma.emailDelivery.update({
      where: { id: e.deliveryId },
      data: { leaseUntil: new Date(0) },
    });
    const recovered = (await new PrismaEmailDeliveryRepository(prisma).claim(new Date()))[0]!;
    expect(recovered.generation).toBeGreaterThan(old.generation);
    await deliveries.settle(old.id, old.generation, 'SENT', new Date());
    expect(
      (await prisma.emailDelivery.findUniqueOrThrow({ where: { id: e.deliveryId } })).status,
    ).toBe('RUNNING');
    const sender = new SmtpMailSender(emailConfig({ EMAIL_SMTP_PORT: smtp.port }));
    const payload = security.decrypt(recovered.id, recovered.encryptedPayload, recovered.keyId);
    await sender.send(e.deliveryId, payload);
    await sender.send(e.deliveryId, payload);
    await deliveries.settle(recovered.id, recovered.generation, 'SENT', new Date());
    await auth.confirm(security.digests(e.token), 'REGISTER', new Date());
    await expect(
      auth.confirm(security.digests(e.token), 'REGISTER', new Date()),
    ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
    expect(await prisma.user.count()).toBe(1);
  });
  it('a restarted worker expires content and converges metadata cleanup without deleting identities', async () => {
    const e = await enroll();
    await auth.confirm(security.digests(e.token), 'REGISTER', new Date());
    const user = await prisma.user.findFirstOrThrow();
    await new PrismaEmailDeliveryRepository(prisma).cleanup(new Date(Date.now() + 9 * 86400000));
    expect(await prisma.emailDelivery.count()).toBe(0);
    expect(await prisma.emailEnrollment.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });
  it('recovers after a real worker process crash during uncertain SMTP delivery', async () => {
    const e = await enroll();
    const environment = emailEnvironment({
      EMAIL_SMTP_PORT: smtp.port,
      EMAIL_SMTP_TIMEOUT_MS: 5000,
      REDIS_URL: 'redis://127.0.0.1:56379/9',
      STT_DELETION_MODE: 'NO_RETENTION',
      STT_STREAMING_MODE: 'SHORT_WINDOW',
      BACKUP_ENVIRONMENT_ID: 'test',
      BACKUP_ENCRYPTION_KEY_ID: 'test',
      BACKUP_RETENTION_COUNT: 1,
      BACKUP_RPO_SECONDS: 60,
      BACKUP_RTO_SECONDS: 60,
    });
    const env = {
      ...process.env,
      ...Object.fromEntries(
        Object.entries(environment).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(',') : String(value),
        ]),
      ),
    };
    const processes: ChildProcess[] = [];
    const start = () => {
      const child = spawn(process.execPath, ['dist/workers/auth-mail/main.js'], {
        env,
        stdio: 'ignore',
      });
      processes.push(child);
      return child;
    };
    const until = async (check: () => Promise<boolean>) => {
      const deadline = Date.now() + 10000;
      while (!(await check())) {
        if (Date.now() > deadline) throw new Error('Worker fixture deadline');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    try {
      smtp.setMode('timeout');
      const first = start();
      await until(async () => smtp.messages.length === 1);
      const crashed = once(first, 'exit');
      first.kill('SIGKILL');
      await crashed;
      expect(
        (await prisma.emailDelivery.findUniqueOrThrow({ where: { id: e.deliveryId } })).status,
      ).toBe('RUNNING');
      // Advance the persisted lease boundary without waiting a real minute.
      await prisma.emailDelivery.update({
        where: { id: e.deliveryId },
        data: { leaseUntil: new Date(0) },
      });
      smtp.setMode('accept');
      start();
      await until(
        async () =>
          (await prisma.emailDelivery.findUniqueOrThrow({ where: { id: e.deliveryId } })).status ===
          'DELIVERED',
      );
      expect(smtp.messages).toHaveLength(2);
      await auth.confirm(security.digests(e.token), 'REGISTER', new Date());
      await expect(
        auth.confirm(security.digests(e.token), 'REGISTER', new Date()),
      ).rejects.toMatchObject({ code: 'EMAIL_TOKEN_INVALID' });
      expect(await prisma.user.count()).toBe(1);
    } finally {
      for (const child of processes)
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, 'exit');
          child.kill('SIGTERM');
          await exited;
        }
    }
  }, 20000);
});
