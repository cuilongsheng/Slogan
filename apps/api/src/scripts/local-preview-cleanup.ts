import { createHash, randomUUID } from 'node:crypto';
import { lstat, open } from 'node:fs/promises';
import type { PrismaService } from '../infrastructure/database/prisma.service.js';
import type { AccountLifecycleRepository } from '../modules/account-lifecycle/index.js';
import { appendBackofficeAuditEvent } from '../modules/audit/index.js';

type LocalCleanupTarget = {
  databaseUrl: string;
  nodeEnvironment?: string | undefined;
  environmentId: string;
  backupPath?: string | undefined;
};
// Deliberately script-only. Never registered as an application provider or HTTP endpoint.
export async function assertLocalCleanupTarget(target: LocalCleanupTarget): Promise<void> {
  const url = new URL(target.databaseUrl);
  if (
    target.nodeEnvironment !== 'development' ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5432' ||
    url.pathname !== '/slogan' ||
    url.search ||
    url.hash ||
    target.environmentId !== 'local-preview' ||
    !target.backupPath
  )
    throw new Error('PREVIEW_LOCAL_TARGET_REQUIRED');
  const stat = await lstat(target.backupPath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o777) !== 0o600 ||
    (process.getuid && stat.uid !== process.getuid()) ||
    stat.size < 100
  )
    throw new Error('PREVIEW_BACKUP_REQUIRED');
  const file = await open(target.backupPath, 'r');
  try {
    const magic = Buffer.alloc(5);
    await file.read(magic, 0, 5, 0);
    if (magic.toString() !== 'PGDMP') throw new Error('PREVIEW_BACKUP_INVALID');
  } finally {
    await file.close();
  }
}
export async function cleanupLocalPreviewAccounts(
  prisma: PrismaService,
  lifecycle: AccountLifecycleRepository,
  target: LocalCleanupTarget,
): Promise<number> {
  await assertLocalCleanupTarget(target);
  const mappings = await prisma.previewAccountProvisioning.findMany();
  if (mappings.some((row) => row.environmentId !== target.environmentId || row.retiredAt))
    throw new Error('PREVIEW_LOCAL_MAPPING_CONFLICT');
  const retained = mappings.map((row) => row.userId);
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', id: { notIn: retained } },
    select: { id: true },
  });
  for (const user of users) {
    // Human-authorized maintenance exception: old development roles may include the last administrator.
    // Only this guarded local CLI can revoke it; the public RBAC API keeps last-admin protection.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
      const roles = await tx.backofficeRoleAssignment.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      // Legacy revocation FK requires a user ID. A terminal, credential-free maintenance marker
      // records the CLI operation without impersonating an authenticated human or adding a usable account.
      const marker = roles.length
        ? await tx.user.create({
            data: { id: randomUUID(), status: 'DELETED', deletedAt: new Date() },
          })
        : undefined;
      for (const role of roles) {
        await tx.backofficeRoleAssignment.update({
          where: { id: role.id },
          data: { revokedAt: new Date(), revokedByUserId: marker!.id, version: { increment: 1 } },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'SYSTEM_JOB',
          actorRoles: [],
          action: 'ROLE_REVOKED',
          targetType: 'USER',
          targetId: user.id,
          reason: 'Human-authorized local preview rebuild: ' + role.role,
          result: 'SUCCEEDED',
          role: role.role,
          details: { localMaintenanceMarkerId: marker!.id },
        });
      }
    });
    // Reuse the lifecycle transaction: destroy credential, revoke sessions/identities, release room/social state,
    // retain audit and FK history. A failed/interrupted run resumes only still-active unregistered users.
    await lifecycle.deleteAccount({
      userId: user.id,
      clientRequestId: randomUUID(),
      payloadHash: createHash('sha256')
        .update('local-preview-rebuild:' + user.id)
        .digest('hex'),
      now: new Date(),
    });
  }
  return users.length;
}
