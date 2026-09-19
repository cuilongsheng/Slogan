import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { BackofficeAuditService } from '../../src/modules/audit/index.js';
import {
  BackofficeBootstrapCommand,
  BackofficeService,
} from '../../src/modules/backoffice/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('backoffice PostgreSQL roles and audit', () => {
  let ref: TestingModule,
    prisma: PrismaService,
    service: BackofficeService,
    command: BackofficeBootstrapCommand,
    audits: BackofficeAuditService;
  beforeAll(async () => {
    installTestEnvironment();
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = ref.get(PrismaService);
    service = ref.get(BackofficeService);
    command = ref.get(BackofficeBootstrapCommand);
    audits = ref.get(BackofficeAuditService);
    await prisma.$connect();
  });
  beforeEach(() => clearRealtimeFixtures(prisma));
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });

  it('atomically bootstraps one admin plus safety role and retries without duplicate audit', async () => {
    const user = await seedAdult(prisma);
    expect(await service.bootstrap(user.id)).toEqual({
      roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'],
      created: true,
    });
    expect(await service.bootstrap(user.id)).toEqual({
      roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'],
      created: false,
    });
    expect(await service.roles(user.id)).toEqual(['PLATFORM_ADMIN', 'SAFETY_OFFICER']);
    expect(await prisma.backofficeRoleAssignment.count()).toBe(2);
    expect(
      await prisma.backofficeAuditEvent.count({ where: { action: 'BACKOFFICE_BOOTSTRAPPED' } }),
    ).toBe(1);
    await expect(service.bootstrap((await seedAdult(prisma)).id)).rejects.toMatchObject({
      code: 'BACKOFFICE_REQUEST_CONFLICT',
    });
  });

  it('exposes a UUID-only command result without provider or database data', async () => {
    const user = await seedAdult(prisma);
    const output = await command.execute(user.id);
    expect(output).toEqual({
      userId: user.id,
      roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'],
      created: true,
    });
    expect(JSON.stringify(output)).not.toMatch(/DATABASE_URL|postgresql|provider|token|secret/i);
    await expect(command.execute('not-a-uuid')).rejects.toThrow(
      'BACKOFFICE_BOOTSTRAP_USER_ID_INVALID',
    );
  });

  it('allows only one concurrent first bootstrap and rejects unavailable or partial targets', async () => {
    const one = await seedAdult(prisma),
      two = await seedAdult(prisma);
    const results = await Promise.allSettled([
      service.bootstrap(one.id),
      service.bootstrap(two.id),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.backofficeRoleAssignment.count({
        where: { role: 'PLATFORM_ADMIN', revokedAt: null },
      }),
    ).toBe(1);
    await clearRealtimeFixtures(prisma);
    const disabled = await seedAdult(prisma);
    await prisma.user.update({ where: { id: disabled.id }, data: { status: 'DISABLED' } });
    await expect(service.bootstrap(disabled.id)).rejects.toMatchObject({
      code: 'BACKOFFICE_USER_NOT_FOUND',
    });
    expect(await prisma.backofficeRoleAssignment.count()).toBe(0);
    await clearRealtimeFixtures(prisma);
    const partial = await seedAdult(prisma);
    await prisma.backofficeRoleAssignment.create({
      data: { id: randomUUID(), userId: partial.id, role: 'SAFETY_OFFICER' },
    });
    await expect(service.bootstrap(partial.id)).rejects.toMatchObject({
      code: 'BACKOFFICE_REQUEST_CONFLICT',
    });
    expect(await prisma.backofficeRoleAssignment.count()).toBe(1);
    expect(await prisma.backofficeAuditEvent.count()).toBe(0);
  });

  it('persists idempotent mutations, detects changed content and retains audit snapshots', async () => {
    const admin = await seedAdult(prisma),
      target = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    const clientRequestId = randomUUID();
    const first = await service.mutateRole({
      actorUserId: admin.id,
      targetUserId: target.id,
      role: 'AUDITOR',
      action: 'GRANT',
      reason: '  compliance review ',
      clientRequestId,
    });
    const retry = await service.mutateRole({
      actorUserId: admin.id,
      targetUserId: target.id,
      role: 'AUDITOR',
      action: 'GRANT',
      reason: 'compliance review',
      clientRequestId,
    });
    expect(retry).toEqual(first);
    await expect(
      service.mutateRole({
        actorUserId: admin.id,
        targetUserId: target.id,
        role: 'SAFETY_OFFICER',
        action: 'GRANT',
        reason: 'compliance review',
        clientRequestId,
      }),
    ).rejects.toMatchObject({ code: 'BACKOFFICE_REQUEST_CONFLICT' });
    expect(await prisma.backofficeAuditEvent.count({ where: { clientRequestId } })).toBe(1);
    await service.mutateRole({
      actorUserId: admin.id,
      targetUserId: target.id,
      role: 'AUDITOR',
      action: 'REVOKE',
      reason: 'review complete',
      clientRequestId: randomUUID(),
    });
    expect(
      await service.mutateRole({
        actorUserId: admin.id,
        targetUserId: target.id,
        role: 'AUDITOR',
        action: 'GRANT',
        reason: 'compliance review',
        clientRequestId,
      }),
    ).toEqual(first);
    const audit = await prisma.backofficeAuditEvent.findFirstOrThrow({
      where: { clientRequestId },
    });
    expect(audit).toMatchObject({
      actorRoles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'],
      reason: 'compliance review',
      result: 'SUCCEEDED',
    });
    expect(Object.keys((audit.details ?? {}) as object).sort()).toEqual([
      'active',
      'assignmentId',
      'grantedAt',
      'revokedAt',
      'version',
    ]);
  });

  it('serializes same-key retries across connections and isolates keys by actor', async () => {
    const admin = await seedAdult(prisma),
      second = await seedAdult(prisma),
      target = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    await service.mutateRole({
      actorUserId: admin.id,
      targetUserId: second.id,
      role: 'PLATFORM_ADMIN',
      action: 'GRANT',
      reason: 'shared administration',
      clientRequestId: randomUUID(),
    });
    const key = randomUUID(),
      input = {
        targetUserId: target.id,
        role: 'AUDITOR' as const,
        action: 'GRANT' as const,
        reason: 'concurrent review',
        clientRequestId: key,
      };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.mutateRole({ actorUserId: admin.id, ...input })),
    );
    expect(new Set(results.map((item) => item.id)).size).toBe(1);
    expect(
      await prisma.backofficeAuditEvent.count({
        where: { actorUserId: admin.id, clientRequestId: key },
      }),
    ).toBe(1);
    await prisma.$disconnect();
    await prisma.$connect();
    expect((await service.mutateRole({ actorUserId: admin.id, ...input })).id).toBe(results[0]?.id);
    await service.mutateRole({ actorUserId: second.id, ...input });
    expect(await prisma.backofficeAuditEvent.count({ where: { clientRequestId: key } })).toBe(2);
  });

  it('rolls back role writes and sensitive list results when audit persistence fails', async () => {
    const admin = await seedAdult(prisma),
      target = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION backoffice_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private reason SELECT secret'; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER backoffice_audit_failure BEFORE INSERT ON "BackofficeAuditEvent" FOR EACH ROW EXECUTE FUNCTION backoffice_audit_fail()`,
    );
    try {
      await expect(
        service.mutateRole({
          actorUserId: admin.id,
          targetUserId: target.id,
          role: 'AUDITOR',
          action: 'GRANT',
          reason: 'private reason',
          clientRequestId: randomUUID(),
        }),
      ).rejects.toThrow();
      expect(
        await prisma.backofficeRoleAssignment.count({
          where: { userId: target.id, role: 'AUDITOR' },
        }),
      ).toBe(0);
      await expect(service.listAssignments(admin.id, { limit: 20 })).rejects.toThrow();
      await expect(
        audits.list(admin.id, ['PLATFORM_ADMIN', 'SAFETY_OFFICER'], { limit: 20 }),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER backoffice_audit_failure ON "BackofficeAuditEvent"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION backoffice_audit_fail()');
    }
  });

  it('does not append a success audit when role persistence fails first', async () => {
    const admin = await seedAdult(prisma),
      target = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    const clientRequestId = randomUUID();
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION backoffice_role_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'role write failed'; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER backoffice_role_failure BEFORE INSERT ON "BackofficeRoleAssignment" FOR EACH ROW EXECUTE FUNCTION backoffice_role_fail()`,
    );
    try {
      await expect(
        service.mutateRole({
          actorUserId: admin.id,
          targetUserId: target.id,
          role: 'AUDITOR',
          action: 'GRANT',
          reason: 'staffing',
          clientRequestId,
        }),
      ).rejects.toThrow();
      expect(await prisma.backofficeAuditEvent.count({ where: { clientRequestId } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER backoffice_role_failure ON "BackofficeRoleAssignment"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION backoffice_role_fail()');
    }
  });

  it('protects the last active admin and permits an audited transfer', async () => {
    const admin = await seedAdult(prisma),
      next = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    await expect(
      service.mutateRole({
        actorUserId: admin.id,
        targetUserId: admin.id,
        role: 'PLATFORM_ADMIN',
        action: 'REVOKE',
        reason: 'transfer',
        clientRequestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'LAST_PLATFORM_ADMIN_REQUIRED' });
    expect(
      await prisma.backofficeAuditEvent.count({
        where: { action: 'ROLE_REVOKED', result: 'REJECTED' },
      }),
    ).toBe(1);
    await service.mutateRole({
      actorUserId: admin.id,
      targetUserId: next.id,
      role: 'PLATFORM_ADMIN',
      action: 'GRANT',
      reason: 'transfer',
      clientRequestId: randomUUID(),
    });
    await service.mutateRole({
      actorUserId: admin.id,
      targetUserId: admin.id,
      role: 'PLATFORM_ADMIN',
      action: 'REVOKE',
      reason: 'transfer',
      clientRequestId: randomUUID(),
    });
    expect(await service.roles(admin.id)).toEqual(['SAFETY_OFFICER']);
    expect(await service.roles(next.id)).toEqual(['PLATFORM_ADMIN']);
  });

  it('never lets concurrent administrator revocations reduce the active set to zero', async () => {
    const first = await seedAdult(prisma),
      second = await seedAdult(prisma);
    await service.bootstrap(first.id);
    await service.mutateRole({
      actorUserId: first.id,
      targetUserId: second.id,
      role: 'PLATFORM_ADMIN',
      action: 'GRANT',
      reason: 'handover',
      clientRequestId: randomUUID(),
    });
    const results = await Promise.allSettled([
      service.mutateRole({
        actorUserId: first.id,
        targetUserId: first.id,
        role: 'PLATFORM_ADMIN',
        action: 'REVOKE',
        reason: 'handover',
        clientRequestId: randomUUID(),
      }),
      service.mutateRole({
        actorUserId: second.id,
        targetUserId: second.id,
        role: 'PLATFORM_ADMIN',
        action: 'REVOKE',
        reason: 'handover',
        clientRequestId: randomUUID(),
      }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.backofficeRoleAssignment.count({
        where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
      }),
    ).toBe(1);
  });

  it('audits stable list reads and removes access immediately for disabled users', async () => {
    const admin = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    const assignments = await service.listAssignments(admin.id, { limit: 1 }, 'request-list');
    expect(assignments.items).toHaveLength(1);
    expect(assignments.nextCursor).not.toBeNull();
    const audit = await audits.list(
      admin.id,
      ['PLATFORM_ADMIN', 'SAFETY_OFFICER'],
      { limit: 50 },
      'request-audit',
    );
    expect(audit.items.map((item) => item.action)).toEqual(
      expect.arrayContaining(['BACKOFFICE_BOOTSTRAPPED', 'ROLE_ASSIGNMENTS_VIEWED']),
    );
    expect(
      await prisma.backofficeAuditEvent.count({ where: { action: 'AUDIT_EVENTS_VIEWED' } }),
    ).toBe(1);
    await prisma.user.update({ where: { id: admin.id }, data: { status: 'DISABLED' } });
    expect(await service.roles(admin.id)).toEqual([]);
    await prisma.user.update({ where: { id: admin.id }, data: { status: 'DELETED' } });
    expect(await service.roles(admin.id)).toEqual([]);
    await expect(service.listAssignments(admin.id, { limit: 20 })).rejects.toMatchObject({
      code: 'BACKOFFICE_ACCESS_DENIED',
    });
  });

  it('paginates and filters role assignments without duplicates or identity fields', async () => {
    const admin = await seedAdult(prisma),
      target = await seedAdult(prisma);
    await service.bootstrap(admin.id);
    for (const role of ['AUDITOR', 'OPERATIONS_ANALYST'] as const)
      await service.mutateRole({
        actorUserId: admin.id,
        targetUserId: target.id,
        role,
        action: 'GRANT',
        reason: 'staffing',
        clientRequestId: randomUUID(),
      });
    const first = await service.listAssignments(admin.id, { limit: 2 });
    expect(first.nextCursor).not.toBeNull();
    const second = await service.listAssignments(admin.id, {
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(4);
    const filtered = await service.listAssignments(admin.id, {
      limit: 20,
      userId: target.id,
      role: 'AUDITOR',
      active: true,
    });
    expect(filtered.items).toHaveLength(1);
    expect(Object.keys(filtered.items[0] ?? {}).sort()).toEqual([
      'active',
      'grantedAt',
      'id',
      'revokedAt',
      'role',
      'userId',
      'version',
    ]);
  });
});
