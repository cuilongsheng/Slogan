import { Prisma } from '../../../generated/prisma/client.js';
import { appendRoomEvent } from '../../audit/persistence.js';
import type { LockedRealtimeRoom } from '../domain/ports/room-realtime.repository.js';
import { readEffectiveSafetyRestriction } from '../../safety/index.js';

export async function loadLockedRealtimeRoom(
  tx: Prisma.TransactionClient,
  roomId: string,
  keywordJobDeadlineSeconds = 600,
): Promise<LockedRealtimeRoom> {
  const times = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  const now = times[0]!.now;
  const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
  const members = await tx.roomMembership.findMany({
    where: { roomId },
    orderBy: { joinOrder: 'asc' },
    include: { user: { include: { profile: true } } },
  });
  const identities = await tx.realtimeIdentity.findMany({ where: { roomId } });
  const context: LockedRealtimeRoom = {
    safetyRestriction: (userId) => readEffectiveSafetyRestriction(tx, userId, now),
    reservedUserIds: (
      await tx.roomReservation.findMany({
        where: { roomId, status: 'BOOKED' },
        select: { userId: true },
      })
    ).map((r) => r.userId),
    expireReservations: async () => {
      await tx.roomReservation.updateMany({
        where: { roomId, status: 'BOOKED' },
        data: { status: 'EXPIRED', version: { increment: 1 } },
      });
      context.reservedUserIds = [];
    },
    now: now!,
    room,
    identities,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role === 'HOST' ? 'HOST' : 'MEMBER',
      lifecycle: m.lifecycle,
      leftAt: m.leftAt,
      removedAt: m.removedAt,
      removalReason: m.removalReason,
      joinOrder: m.joinOrder,
      displayName: m.user.profile?.displayName ?? '',
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      nationalityCode: m.user.profile?.nationalityCode ?? null,
      cefrLevel: m.user.profile?.cefrLevel ?? '',
      accountActive: m.user.status === 'ACTIVE',
      participantIdentity: m.participantIdentity,
      credentialVersion: m.credentialVersion,
      presence: m.presence === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED',
      providerSessionSid: m.providerSessionSid,
      presenceUpdatedAt: m.presenceUpdatedAt,
    })),
    saveRoom: async (patch) => {
      await tx.room.update({ where: { id: roomId }, data: patch });
      if (patch.status === 'ENDING' || patch.status === 'ENDED') {
        await tx.roomTextMessage.deleteMany({ where: { roomId } });
        const summary = await tx.roomKeywordSummary.findUnique({ where: { roomId } });
        if (summary && summary.status === 'COLLECTING') {
          await tx.roomKeywordSummary.update({
            where: { id: summary.id },
            data: { status: 'PENDING', version: { increment: 1 } },
          });
          await tx.roomKeywordSummaryJob.upsert({
            where: { summaryId: summary.id },
            create: {
              summaryId: summary.id,
              nextAttemptAt: now,
              deadlineAt: new Date(now.getTime() + keywordJobDeadlineSeconds * 1000),
            },
            update: {},
          });
        }
      }
      Object.assign(room, patch);
    },
    saveMember: async (id, patch) => {
      await tx.roomMembership.update({ where: { id }, data: patch });
      Object.assign(
        context.members.find((m) => m.id === id)!,
        patch,
      );
    },
    reserveIssuance: async (id, identity, expiresAt) => {
      await tx.realtimeIssuance.create({ data: { id, identity, expiresAt } });
    },
    rememberIdentity: async (record) => {
      await tx.realtimeIdentity.upsert({
        where: { identity: record.identity },
        create: record,
        update: { issueUntil: record.issueUntil },
      });
      const existing = identities.find((i) => i.identity === record.identity);
      if (existing) Object.assign(existing, record);
      else identities.push(record);
    },
    appendEvent: async (event) => {
      return appendRoomEvent(tx, { ...event, roomId });
    },
    enqueue: async (type, identity) => {
      const version = type === 'HOST_TIMEOUT' ? room.hostReconnectVersion : room.stateVersion;
      const key = `${type}-${roomId}-${identity ?? 'room'}-${version}`;
      await tx.realtimeCommand.upsert({
        where: { key },
        create: {
          key,
          roomId,
          type,
          identity: identity ?? null,
          stateVersion: version,
          ...(type === 'HOST_TIMEOUT' ? { nextAttemptAt: room.hostReconnectDeadline! } : {}),
        },
        update: {},
      });
    },
  };
  return context;
}
