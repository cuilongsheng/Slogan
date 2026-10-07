import {
  ROOM_CEFR_LEVELS,
  ROOM_VISIBILITIES,
  type RoomDiscoveryFilter,
  type RoomStatus,
  type CreateRoomInput,
  type ValidatedRoomCreation,
} from '../entities/room.js';
import { RoomError } from '../errors/room.error.js';

import { roomLevelRange } from './room-level-range.js';

type RoomEligibilityState = 'PROFILE_REQUIRED' | 'AGE_RESTRICTED' | 'ELIGIBLE';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export class RoomPolicy {
  assertEligible(state: RoomEligibilityState): void {
    if (state === 'PROFILE_REQUIRED') {
      throw new RoomError('PROFILE_REQUIRED', 'Complete your profile before using rooms');
    }
    if (state === 'AGE_RESTRICTED') {
      throw new RoomError('AGE_RESTRICTED', 'Rooms are available only to adults');
    }
  }

  validateCreation(input: CreateRoomInput, now: Date): ValidatedRoomCreation {
    const topic = input.topic.trim();
    if ((input.cefrLevelMin === undefined) !== (input.cefrLevelMax === undefined))
      throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Both room level boundaries are required');
    const range = roomLevelRange(input);
    if (input.cefrLevel && input.cefrLevel !== range.cefrLevelMin)
      throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Conflicting room level fields');
    if (
      topic.length < 2 ||
      topic.length > 120 ||
      !Number.isInteger(input.capacity) ||
      input.capacity < 2 ||
      input.capacity > 6 ||
      (input.password !== undefined && !/^\d{4}$/.test(input.password)) ||
      (input.visibility !== undefined && !ROOM_VISIBILITIES.includes(input.visibility))
    ) {
      throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Room configuration is invalid');
    }
    return {
      topic,
      cefrLevel: range.cefrLevelMin,
      ...range,
      capacity: input.capacity,
      startedAt: now,
      endsAt: new Date(now.getTime() + TWO_HOURS_MS),
      visibility: input.visibility ?? 'PUBLIC',
      sensitiveSpeechDetectionEnabled: input.sensitiveSpeechDetectionEnabled ?? false,
      postRoomKeywordsEnabled: input.postRoomKeywordsEnabled ?? false,
    };
  }

  normalizeDiscovery(input: { cefrLevel?: string; topic?: string }): RoomDiscoveryFilter {
    if (
      input.cefrLevel !== undefined &&
      !ROOM_CEFR_LEVELS.some((level) => level === input.cefrLevel)
    )
      throw new RoomError('VALIDATION_FAILED', 'Room discovery filter is invalid');
    const topic = input.topic?.trim() ?? null;
    if (input.topic !== undefined && (!topic || topic.length > 120))
      throw new RoomError('VALIDATION_FAILED', 'Room discovery filter is invalid');
    return {
      cefrLevel: (input.cefrLevel as RoomDiscoveryFilter['cefrLevel']) ?? null,
      topic: topic?.toLocaleLowerCase('en-US') ?? null,
    };
  }

  assertCanExtend(input: {
    hostUserId: string;
    actorUserId: string;
    status: RoomStatus;
    endsAt: Date;
    now: Date;
    extensionCount: number;
    additionalMinutes: number;
  }): void {
    if (input.hostUserId !== input.actorUserId)
      throw new RoomError('ROOM_HOST_REQUIRED', 'Current host permission is required');
    if (input.status !== 'OPEN' || input.endsAt <= input.now)
      throw new RoomError('ROOM_EXTENSION_NOT_AVAILABLE', 'Room cannot be extended');
    if (
      !Number.isInteger(input.additionalMinutes) ||
      input.additionalMinutes < 1 ||
      input.additionalMinutes > 60
    )
      throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Extension minutes are invalid');
    if (input.extensionCount >= 3)
      throw new RoomError('ROOM_EXTENSION_LIMIT', 'Room extension limit reached');
  }

  assertOpen(status: RoomStatus, endsAt: Date, now: Date): void {
    if (status !== 'OPEN' || endsAt <= now) {
      throw new RoomError('ROOM_ENDED', 'The room has ended');
    }
  }

  assertCanJoin(input: {
    status: RoomStatus;
    endsAt: Date;
    now: Date;
    rulesAccepted: boolean;
    passwordProtected: boolean;
    passwordProvided: boolean;
    passwordValid: boolean;
    memberCount: number;
    capacity: number;
  }): void {
    this.assertOpen(input.status, input.endsAt, input.now);
    if (!input.rulesAccepted) {
      throw new RoomError('ROOM_RULES_NOT_ACCEPTED', 'Room rules must be accepted');
    }
    if (input.passwordProtected && !input.passwordProvided) {
      throw new RoomError('ROOM_PASSWORD_REQUIRED', 'Room password is required');
    }
    if (input.passwordProtected && !input.passwordValid) {
      throw new RoomError('ROOM_PASSWORD_INVALID', 'Room password is invalid');
    }
    if (input.memberCount >= input.capacity) {
      throw new RoomError('ROOM_FULL', 'The room is full');
    }
  }
}
