import type { Prisma } from '../../../generated/prisma/client.js';
// Caller owns the transaction; no body text or provider payload belongs in these events.
export async function appendRoomEvent(
  tx: Prisma.TransactionClient,
  event: Prisma.RoomEventCreateManyInput,
) {
  const result = await tx.roomEvent.createMany({ data: [event], skipDuplicates: true });
  return result.count === 1;
}
