import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../../config/environment.js';
import { ProfilesService } from '../../../profiles/index.js';
import type {
  CreateRoomInput,
  RoomDetail,
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
    config: ConfigService<Environment, true>,
  ) {
    this.rulesVersion = config.get('ROOM_RULES_VERSION', { infer: true });
  }

  async create(userId: string, input: CreateRoomInput, now = new Date()): Promise<RoomDetail> {
    await this.assertEligible(userId, now);
    const creation = this.policy.validateCreation(input, now);
    const roomId = randomUUID();
    return this.rooms.createWithHost({
      ...creation,
      id: roomId,
      hostUserId: userId,
      hostMembershipId: randomUUID(),
      passwordDigest:
        input.password === undefined ? null : this.passwords.digest(roomId, input.password),
      rulesVersion: this.rulesVersion,
    });
  }

  async list(
    userId: string,
    input: { cursor?: string; limit?: number },
    now = new Date(),
  ): Promise<{ items: RoomDetail['room'][]; nextCursor: string | null }> {
    await this.assertEligible(userId, now);
    const page: RoomListPage = await this.rooms.listOpen({
      userId,
      now,
      limit: input.limit ?? 20,
      cursor: input.cursor === undefined ? null : this.decodeCursor(input.cursor),
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor === null ? null : this.encodeCursor(page.nextCursor),
    };
  }

  async detail(userId: string, roomId: string, now = new Date()): Promise<RoomDetail> {
    await this.assertEligible(userId, now);
    const detail = await this.rooms.findDetail(roomId, userId);
    if (detail === null) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    this.policy.assertOpen(detail.room.status, detail.room.endsAt, now);
    return detail;
  }

  async join(
    userId: string,
    roomId: string,
    input: { rulesAccepted: boolean; password?: string },
    now = new Date(),
  ): Promise<RoomDetail> {
    await this.assertEligible(userId, now);
    const result = await this.rooms.withLockedRoom(roomId, userId, async (locked) => {
      this.policy.assertOpen(locked.room.status, locked.room.endsAt, now);
      if (locked.existingMembership !== null) {
        return { room: locked.room, currentMembership: locked.existingMembership };
      }
      const passwordProtected = locked.room.passwordDigest !== null;
      const passwordProvided = input.password !== undefined;
      const passwordValid =
        locked.room.passwordDigest === null || input.password === undefined
          ? false
          : this.passwords.matches(roomId, input.password, locked.room.passwordDigest);
      this.policy.assertCanJoin({
        status: locked.room.status,
        endsAt: locked.room.endsAt,
        now,
        rulesAccepted: input.rulesAccepted,
        passwordProtected,
        passwordProvided,
        passwordValid,
        memberCount: locked.room.memberCount,
        capacity: locked.room.capacity,
      });
      const membership = await locked.createMembership({
        id: randomUUID(),
        userId,
        rulesVersion: this.rulesVersion,
        now,
      });
      return {
        room: { ...locked.room, memberCount: locked.room.memberCount + 1 },
        currentMembership: membership,
      };
    });
    if (result === null) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    return result;
  }

  private async assertEligible(userId: string, now: Date): Promise<void> {
    this.policy.assertEligible(await this.profiles.getOnboardingState(userId, now));
  }

  private encodeCursor(cursor: RoomListCursor): string {
    return Buffer.from(
      JSON.stringify({ startedAt: cursor.startedAt.toISOString(), id: cursor.id }),
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): RoomListCursor {
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
      const startedAt = new Date(parsed.startedAt);
      if (Number.isNaN(startedAt.getTime()) || startedAt.toISOString() !== parsed.startedAt) {
        throw new Error('Invalid cursor date');
      }
      return { startedAt, id: parsed.id };
    } catch {
      throw new RoomError('VALIDATION_FAILED', 'Room cursor is invalid');
    }
  }
}
