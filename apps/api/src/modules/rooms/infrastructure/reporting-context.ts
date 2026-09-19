import { Prisma } from '../../../generated/prisma/client.js';

// Public, transaction-scoped infrastructure integration. No active-room/presence filter:
// retained membership rows originate at actual join, including subsequently INVITED rows.
export async function readReportingContext(
  tx: Prisma.TransactionClient,
  roomId: string,
  reporterUserId: string,
  targetUserId: string,
) {
  const rooms = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Room" WHERE "id" = ${roomId}::uuid FOR UPDATE`,
  );
  if (!rooms.length) return null;
  const members = await tx.roomMembership.findMany({
    where: { roomId, userId: { in: [reporterUserId, targetUserId] } },
    select: { userId: true, joinedAt: true },
  });
  return {
    roomId,
    reporter: members.find((m) => m.userId === reporterUserId) ?? null,
    target: members.find((m) => m.userId === targetUserId) ?? null,
  };
}
