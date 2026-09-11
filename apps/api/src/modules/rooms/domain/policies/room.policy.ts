import {
  ROOM_CEFR_LEVELS,
  type CreateRoomInput,
  type ValidatedRoomCreation,
} from '../entities/room.js';
import { RoomError } from '../errors/room.error.js';

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
    if (
      topic.length < 2 ||
      topic.length > 120 ||
      !ROOM_CEFR_LEVELS.includes(input.cefrLevel) ||
      !Number.isInteger(input.capacity) ||
      input.capacity < 2 ||
      input.capacity > 6 ||
      (input.password !== undefined && !/^\d{4}$/.test(input.password))
    ) {
      throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Room configuration is invalid');
    }
    return {
      topic,
      cefrLevel: input.cefrLevel,
      capacity: input.capacity,
      startedAt: now,
      endsAt: new Date(now.getTime() + TWO_HOURS_MS),
    };
  }

  assertOpen(status: 'OPEN' | 'ENDED', endsAt: Date, now: Date): void {
    if (status !== 'OPEN' || endsAt <= now) {
      throw new RoomError('ROOM_ENDED', 'The room has ended');
    }
  }

  assertCanJoin(input: {
    status: 'OPEN' | 'ENDED';
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
