import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { RoomSpeechProcessingRepository } from '../domain/room-speech-processing.repository.js';

@Injectable()
export class PrismaRoomSpeechProcessingRepository implements RoomSpeechProcessingRepository {
  constructor(private readonly prisma: PrismaService) {}

  activeRooms(input: Parameters<RoomSpeechProcessingRepository['activeRooms']>[0]) {
    const purposes = [
      ...(input.safetyEnabled ? [{ sensitiveSpeechDetectionEnabled: true }] : []),
      ...(input.postRoomKeywordsEnabled ? [{ postRoomKeywordsEnabled: true }] : []),
    ];
    if (!purposes.length) return Promise.resolve([]);
    return this.prisma.room.findMany({
      where: { status: 'OPEN', endsAt: { gt: input.now }, OR: purposes },
      select: { id: true, endsAt: true },
      orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  }

  async participant(input: Parameters<RoomSpeechProcessingRepository['participant']>[0]) {
    const identity = await this.prisma.realtimeIdentity.findFirst({
      where: {
        identity: input.participantIdentity,
        roomId: input.roomId,
        revokedAt: null,
        membership: { lifecycle: 'ACTIVE', room: { status: 'OPEN', endsAt: { gt: new Date() } } },
      },
      include: { membership: { include: { room: true } } },
    });
    if (!identity) return null;
    const room = identity.membership.room;
    if (!room.sensitiveSpeechDetectionEnabled && !room.postRoomKeywordsEnabled) return null;
    const purposes = [
      ...(room.sensitiveSpeechDetectionEnabled ? (['ROOM_SAFETY_DETECTION'] as const) : []),
      ...(room.postRoomKeywordsEnabled ? (['POST_ROOM_KEYWORDS'] as const) : []),
    ];
    const events = await this.prisma.speechProcessingConsentEvent.findMany({
      where: { userId: identity.membership.userId, purpose: { in: purposes } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const latest = new Map<string, (typeof events)[number]>();
    for (const event of events) if (!latest.has(event.purpose)) latest.set(event.purpose, event);
    const safety = latest.get('ROOM_SAFETY_DETECTION');
    const keywords = latest.get('POST_ROOM_KEYWORDS');
    if (
      room.sensitiveSpeechDetectionEnabled &&
      (safety?.action !== 'ACCEPT' || safety.noticeVersion !== input.safetyNoticeVersion)
    )
      return null;
    if (
      room.postRoomKeywordsEnabled &&
      (keywords?.action !== 'ACCEPT' ||
        keywords.noticeVersion !== input.postRoomKeywordsNoticeVersion)
    )
      return null;
    return {
      roomId: room.id,
      participantIdentity: input.participantIdentity,
      roomEndsAt: room.endsAt,
      safety: room.sensitiveSpeechDetectionEnabled
        ? {
            roomId: room.id,
            userId: identity.membership.userId,
            participantIdentity: input.participantIdentity,
            consentGeneration: safety!.id,
            roomEndsAt: room.endsAt,
          }
        : null,
      postRoomKeywordsConsentGeneration: room.postRoomKeywordsEnabled ? keywords!.id : null,
    };
  }
}
