import type { Prisma } from '../../generated/prisma/client.js';

export const PLATFORM_ADMIN_SET_LOCK = 8_121_002;

export async function lockPlatformAdminSet(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLATFORM_ADMIN_SET_LOCK})`;
}
