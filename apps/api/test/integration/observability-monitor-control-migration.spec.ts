import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { testEnvironment } from '../fixtures/environment.js';

it('adds the shared monitor gate without changing existing completed windows or failures', async () => {
  const prisma = new PrismaService(new ConfigService(testEnvironment()));
  const schema = `monitor_upgrade_${randomUUID().replaceAll('-', '')}`;
  const migration = await readFile(
    new URL(
      '../../prisma/migrations/20261017080000_observability_monitor_control/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(
        'CREATE TABLE "ObservabilityMonitorState" (environment varchar(16), "monitorKey" varchar(64), "completedWindow" bigint NOT NULL, "consecutiveFailures" integer NOT NULL, PRIMARY KEY (environment,"monitorKey"))',
      );
      await tx.$executeRawUnsafe(
        "INSERT INTO \"ObservabilityMonitorState\" VALUES ('test','SCAN',42,2)",
      );
      await tx.$executeRawUnsafe(migration);
      const rows = await tx.$queryRawUnsafe<
        Array<{ enabled: boolean; completedWindow: bigint; consecutiveFailures: number }>
      >('SELECT enabled,"completedWindow","consecutiveFailures" FROM "ObservabilityMonitorState"');
      expect(rows).toEqual([{ enabled: true, completedWindow: 42n, consecutiveFailures: 2 }]);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  } finally {
    await prisma.$disconnect();
  }
});
