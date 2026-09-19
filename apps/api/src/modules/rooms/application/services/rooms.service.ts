import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomSpeechReadinessStore } from '../../../../infrastructure/redis/room-speech-readiness.service.js';

import type { Environment } from '../../../../config/environment.js';
import { ProfilesService } from '../../../profiles/index.js';
import type {
  CreateRoomInput,
  RoomDiscoveryFilter,
  RoomDetail,
  RoomExtensionResult,
  RoomListCursor,
  RoomListPage,
} from '../../domain/entities/room.js';
import { RoomError } from '../../domain/errors/room.error.js';
import {
  ROOM_PASSWORD_HASHER,
  type RoomPasswordHasher,
} from '../../domain/ports/room-password.port.js';
import { ROOM_REPOSITORY, type RoomRepository } from '../../domain/ports/room.repository.js';
import { RoomPolicy } from '../../domain/policies/room.policy.js';

@Injectable()
export class RoomsService {
  private readonly rulesVersion: string;

  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(ROOM_PASSWORD_HASHER) private readonly passwords: RoomPasswordHasher,
    private readonly profiles: ProfilesService,
    private readonly policy: RoomPolicy,
    private readonly config: ConfigService<Environment, true>,
    private readonly speechReadiness: RoomSpeechReadinessStore,
  ) {
    this.rulesVersion = config.get('ROOM_RULES_VERSION', { infer: true });
  }

  async create(
    userId: string,
    input: CreateRoomInput,
    now = new Date(),
  ): Promise<RoomDetail & { shareUrl: string }> {
    await this.assertEligible(userId, now);
    await this.assertSpeechCapability(input.sensitiveSpeechDetectionEnabled ?? false);
    await this.assertPostRoomKeywordsCapability(input.postRoomKeywordsEnabled ?? false);
    await this.assertSpeechConsentForCreation(userId, input.sensitiveSpeechDetectionEnabled);
    await this.assertPostRoomKeywordsConsentForCreation(userId, input.postRoomKeywordsEnabled);
    const creation = this.policy.validateCreation(input, now);
    const roomId = randomUUID();
    const detail = await this.rooms.createWithHost({
      ...creation,
      id: roomId,
      hostUserId: userId,
      hostMembershipId: randomUUID(),
      passwordDigest:
        input.password === undefined ? null : this.passwords.digest(roomId, input.password),
      rulesVersion: this.rulesVersion,
      shareCode: randomUUID(),
      keywordExtractorVersion: this.config.get('POST_ROOM_KEYWORDS_EXTRACTOR_VERSION', {
        infer: true,
      }),
    });
    return { ...detail, shareUrl: this.shareUrl(detail.room.shareCode) };
  }

  async list(
    userId: string,
    input: { cursor?: string; limit?: number; cefrLevel?: string; topic?: string },
    now = new Date(),
  ): Promise<{ items: RoomDetail['room'][]; nextCursor: string | null }> {
    await this.assertEligible(userId, now);
    const filter = this.policy.normalizeDiscovery(input);
    const page: RoomListPage = await this.rooms.listOpen({
      userId,
      now,
      limit: input.limit ?? 20,
      cursor:
        input.cursor === undefined
          ? null
          : this.decodeDiscoveryCursor('INSTANT', input.cursor, filter),
      filter,
    });
    return {
      items: page.items,
      nextCursor:
        page.nextCursor === null
          ? null
          : this.encodeDiscoveryCursor('INSTANT', page.nextCursor, filter),
    };
  }

  async detail(
    userId: string,
    roomId: string,
    now = new Date(),
  ): Promise<RoomDetail & { shareUrl: string }> {
    await this.assertEligible(userId, now);
    const detail = await this.rooms.findDetail(roomId, userId);
    if (detail === null) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    if (detail.room.status === 'SCHEDULED')
      throw new RoomError('ROOM_NOT_STARTED', 'Room has not started', {
        startsAt: detail.room.startedAt.toISOString(),
      });
    if (detail.room.status === 'CANCELLED')
      throw new RoomError('ROOM_CANCELLED', 'Room was cancelled');
    this.policy.assertOpen(detail.room.status, detail.room.endsAt, now);
    return { ...detail, shareUrl: this.shareUrl(detail.room.shareCode) };
  }

  async resolveShare(shareCode: string) {
    const result = await this.rooms.findByShareCode(shareCode);
    if (result === null) throw new RoomError('ROOM_SHARE_NOT_FOUND', 'Room share link not found');
    if (result.status === 'UNAVAILABLE')
      throw new RoomError('ROOM_SHARE_UNAVAILABLE', 'Room share link is unavailable');
    return result.room;
  }

  async extend(
    actorUserId: string,
    roomId: string,
    input: { clientRequestId: string; additionalMinutes: number },
  ): Promise<RoomExtensionResult> {
    await this.assertEligible(actorUserId);
    return this.rooms.extend({ roomId, actorUserId, ...input });
  }

  async join(
    userId: string,
    roomId: string,
    input: { rulesAccepted: boolean; password?: string; invitationId?: string },
    now?: Date,
  ): Promise<RoomDetail & { shareUrl: string }> {
    await this.assertEligible(userId, now ?? new Date());
    const result = await this.rooms.withLockedRoom(roomId, userId, async (locked) => {
      if (!locked.accountActive)
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
      if (locked.safetyRestriction)
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is temporarily restricted', {
          severity: locked.safetyRestriction.severity,
          endsAt: locked.safetyRestriction.endsAt.toISOString(),
        });
      const checkedAt = now ?? locked.now ?? new Date();
      if (locked.room.status === 'SCHEDULED')
        throw new RoomError('ROOM_NOT_STARTED', 'Room has not started', {
          startsAt: locked.room.startedAt.toISOString(),
        });
      if (locked.room.status === 'CANCELLED')
        throw new RoomError('ROOM_CANCELLED', 'Room was cancelled');
      this.policy.assertOpen(locked.room.status, locked.room.endsAt, checkedAt);
      if (locked.existingMembership?.lifecycle === 'ACTIVE') {
        if (input.invitationId)
          await locked.consumeInvitation(input.invitationId, now ?? new Date());
        return { room: locked.room, currentMembership: locked.existingMembership };
      }
      if (locked.existingMembership?.lifecycle === 'REMOVED')
        throw new RoomError('ROOM_INVITATION_REQUIRED', 'A host invitation is required');
      if (locked.room.hostReconnectDeadline)
        throw new RoomError('ROOM_HOST_RECONNECTING', 'Host reconnection is pending', {
          retryAt: locked.room.hostReconnectDeadline.toISOString(),
        });
      if (locked.room.sensitiveSpeechDetectionEnabled && locked.roomSpeechConsentAccepted !== true)
        throw new RoomError(
          'ROOM_SPEECH_CONSENT_REQUIRED',
          'Room speech processing consent is required',
        );
      if (locked.room.postRoomKeywordsEnabled && locked.postRoomKeywordsConsentAccepted !== true)
        throw new RoomError(
          'POST_ROOM_KEYWORDS_CONSENT_REQUIRED',
          'Post-room keyword processing consent is required',
        );
      const passwordProtected = locked.room.passwordDigest !== null;
      const passwordProvided = input.password !== undefined;
      const passwordValid =
        locked.room.passwordDigest === null || input.password === undefined
          ? false
          : this.passwords.matches(roomId, input.password, locked.room.passwordDigest);
      this.policy.assertCanJoin({
        status: locked.room.status,
        endsAt: locked.room.endsAt,
        now: checkedAt,
        rulesAccepted: input.rulesAccepted,
        passwordProtected,
        passwordProvided,
        passwordValid,
        memberCount: locked.room.memberCount,
        capacity: locked.room.capacity,
      });
      const reserved = locked.reservedUserIds ?? [];
      if (
        !reserved.includes(userId) &&
        locked.room.memberCount + reserved.length >= locked.room.capacity
      )
        throw new RoomError('ROOM_RESERVED', 'Remaining seats are reserved');
      if (input.invitationId) await locked.consumeInvitation(input.invitationId, checkedAt);
      const membership = await locked.createMembership({
        id: randomUUID(),
        userId,
        rulesVersion: this.rulesVersion,
        now: checkedAt,
      });
      return {
        room: { ...locked.room, memberCount: locked.room.memberCount + 1 },
        currentMembership: membership,
      };
    });
    if (result === null) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    return { ...result, shareUrl: this.shareUrl(result.room.shareCode) };
  }

  async assertEligible(userId: string, now = new Date()): Promise<void> {
    this.policy.assertEligible(await this.profiles.getOnboardingState(userId, now));
  }

  async assistanceContext(userId: string, roomId: string, now = new Date()) {
    const context = await this.rooms.readAssistanceContext({ roomId, userId, now });
    if (!context) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    if (!context.userEligible)
      throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
    if (!context.membershipActive)
      throw new RoomError('ROOM_MEMBERSHIP_REQUIRED', 'Active room membership is required');
    if (context.status !== 'OPEN' || context.endsAt <= now)
      throw new RoomError('ROOM_ENDED', 'Room is no longer open');
    return { roomId: context.roomId, topic: context.topic, cefrLevel: context.cefrLevel };
  }

  shareUrl(shareCode: string): string {
    return new URL(encodeURIComponent(shareCode), this.configuredShareBase()).toString();
  }

  postRoomKeywordExtractorVersion(): string {
    return this.config.get('POST_ROOM_KEYWORDS_EXTRACTOR_VERSION', { infer: true });
  }

  encodeDiscoveryCursor(
    kind: 'INSTANT' | 'APPOINTMENT',
    cursor: RoomListCursor,
    filter: RoomDiscoveryFilter,
  ): string {
    return Buffer.from(
      JSON.stringify({
        v: 1,
        kind,
        cefrLevel: filter.cefrLevel,
        topic: filter.topic,
        startedAt: cursor.startedAt.toISOString(),
        id: cursor.id,
      }),
    ).toString('base64url');
  }

  decodeDiscoveryCursor(
    kind: 'INSTANT' | 'APPOINTMENT',
    cursor: string,
    filter: RoomDiscoveryFilter,
  ): RoomListCursor {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('startedAt' in parsed) ||
        typeof parsed.startedAt !== 'string' ||
        !('id' in parsed) ||
        typeof parsed.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          parsed.id,
        )
      ) {
        throw new Error('Invalid cursor shape');
      }
      const value = parsed as Record<string, unknown>;
      const versioned = 'v' in value;
      if (
        (versioned &&
          (value.v !== 1 ||
            value.kind !== kind ||
            value.cefrLevel !== filter.cefrLevel ||
            value.topic !== filter.topic)) ||
        (!versioned && (filter.cefrLevel !== null || filter.topic !== null))
      )
        throw new Error('Cursor context mismatch');
      const startedAt = new Date(parsed.startedAt);
      if (Number.isNaN(startedAt.getTime()) || startedAt.toISOString() !== parsed.startedAt) {
        throw new Error('Invalid cursor date');
      }
      return { startedAt, id: parsed.id };
    } catch {
      throw new RoomError('VALIDATION_FAILED', 'Room cursor is invalid');
    }
  }

  normalizeDiscovery(input: { cefrLevel?: string; topic?: string }): RoomDiscoveryFilter {
    return this.policy.normalizeDiscovery(input);
  }

  async assertSpeechCapability(requested: boolean): Promise<void> {
    if (requested && !this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true }))
      throw new RoomError('ROOM_SPEECH_UNAVAILABLE', 'Room speech detection is unavailable');
    if (requested && !(await this.speechReadiness.isReady()))
      throw new RoomError('ROOM_SPEECH_UNAVAILABLE', 'Room speech detection is unavailable');
  }

  async assertSpeechConsentForCreation(userId: string, requested = false): Promise<void> {
    if (!requested) return;
    const accepted = await this.rooms.processingConsentAccepted(
      userId,
      'ROOM_SAFETY_DETECTION',
      this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true }),
    );
    if (!accepted)
      throw new RoomError(
        'ROOM_SPEECH_CONSENT_REQUIRED',
        'Room speech processing consent is required',
      );
  }

  async assertPostRoomKeywordsCapability(requested: boolean): Promise<void> {
    if (requested && !this.config.get('POST_ROOM_KEYWORDS_ENABLED', { infer: true }))
      throw new RoomError('POST_ROOM_KEYWORDS_UNAVAILABLE', 'Post-room keywords are unavailable');
    if (requested && !(await this.speechReadiness.isReady()))
      throw new RoomError('POST_ROOM_KEYWORDS_UNAVAILABLE', 'Post-room keywords are unavailable');
  }

  async assertPostRoomKeywordsConsentForCreation(userId: string, requested = false): Promise<void> {
    if (!requested) return;
    const accepted = await this.rooms.processingConsentAccepted(
      userId,
      'POST_ROOM_KEYWORDS',
      this.config.get('POST_ROOM_KEYWORDS_NOTICE_VERSION', { infer: true }),
    );
    if (!accepted)
      throw new RoomError(
        'POST_ROOM_KEYWORDS_CONSENT_REQUIRED',
        'Post-room keyword processing consent is required',
      );
  }

  async assertSpeechAccess(
    userId: string,
    room: { sensitiveSpeechDetectionEnabled: boolean; postRoomKeywordsEnabled: boolean },
  ): Promise<void> {
    if (room.sensitiveSpeechDetectionEnabled)
      await this.assertSpeechConsentForCreation(userId, true);
    if (room.postRoomKeywordsEnabled)
      await this.assertPostRoomKeywordsConsentForCreation(userId, true);
  }

  private configuredShareBase(): string {
    const configured = this.config.get('ROOM_SHARE_BASE_URL', { infer: true });
    return configured.endsWith('/') ? configured : `${configured}/`;
  }
}
