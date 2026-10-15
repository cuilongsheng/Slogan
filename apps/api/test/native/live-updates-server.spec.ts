import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/testing.js';
import { SocialService } from '../../src/modules/social/index.js';
import { DirectService } from '../../src/modules/direct/index.js';
import { LiveUpdatesService } from '../../src/modules/live-updates/index.js';
import { emailEnvironment } from '../fixtures/email-auth.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

// Manual, local-only native acceptance fixture. Never part of the deployed application.
(process.env.SLOGAN_NATIVE_FIXTURE === '1' ? test : test.skip)(
  'serve real local auth/database/Redis for native streaming acceptance',
  async () => {
    installTestEnvironment(
      emailEnvironment({
        REDIS_URL: 'redis://127.0.0.1:56379/8',
        CORS_ALLOWED_ORIGINS: 'http://localhost:8082',
      }),
    );
    const { AppModule } = await import('../../src/app.module.js');
    const { configureApiApp } = await import('../../src/bootstrap/create-api-app.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = ref.createNestApplication();
    configureApiApp(app);
    const prisma = ref.get(PrismaService);
    await clearRealtimeFixtures(prisma);
    const alice = await seedAdult(prisma, 'Native SSE Alice');
    const bob = await seedAdult(prisma, 'Native SSE Bob');
    await prisma.emailCredential.create({
      data: {
        userId: alice.id,
        username: 'stream_smoke',
        email: 'stream_smoke@example.test',
        origin: 'EMAIL_VERIFIED',
        verifiedAt: new Date(),
        passwordHash: await new ScryptPasswordHasher().hash('SseFixture26!'),
      },
    });
    const social = ref.get(SocialService),
      direct = ref.get(DirectService);
    await social.heartbeat(alice.id);
    await social.heartbeat(bob.id);
    const conversation = await direct.open(bob.id, alice.id);
    await app.listen(3000, '127.0.0.1');
    await writeFile('/tmp/slogan-native-ready', 'ready');
    let previous = '';
    try {
      for (;;) {
        const command = await readFile('/tmp/slogan-native-command', 'utf8').catch(() => '');
        if (command === 'stop') break;
        if (command && command !== previous) {
          previous = command;
          await direct.send(bob.id, conversation.id, command.trim(), randomUUID());
          await ref.get(LiveUpdatesService).recover();
          await writeFile('/tmp/slogan-native-receipt', command);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } finally {
      await app.close();
    }
  },
  3600000,
);
