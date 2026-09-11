import { randomUUID } from 'node:crypto';

import {
  AuthError,
  type AuthRepository,
  type OAuthExchangeInput,
  type OAuthProviderName,
  type OAuthProviderRegistry,
  type ProviderIdentity,
  type RotateRefreshResult,
} from '../../src/modules/auth/index.js';
import type {
  ProfileData,
  ProfileRecord,
  ProfileRepository,
} from '../../src/modules/profiles/index.js';
import type {
  CreateRoomRepositoryInput,
  LockedRoom,
  RoomDetail,
  RoomListPage,
  RoomMembershipRecord,
  RoomRecord,
  RoomRepository,
} from '../../src/modules/rooms/index.js';

interface MemorySession {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface MemoryRefreshToken {
  sessionId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export class MemoryAuthRepository implements AuthRepository {
  private readonly identities = new Map<string, { userId: string; provider: OAuthProviderName }>();
  private readonly sessions = new Map<string, MemorySession>();
  private readonly refreshTokens = new Map<string, MemoryRefreshToken>();

  async findOrCreateUser(
    identity: ProviderIdentity,
    _now: Date,
  ): Promise<{ userId: string; created: boolean }> {
    const key = `${identity.issuer}\0${identity.subject}`;
    const existing = this.identities.get(key);
    if (existing !== undefined) return { userId: existing.userId, created: false };
    const userId = randomUUID();
    this.identities.set(key, { userId, provider: identity.provider });
    return { userId, created: true };
  }

  async createSession(input: {
    userId: string;
    deviceName?: string;
    digest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      userId: input.userId,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
    this.refreshTokens.set(input.digest, {
      sessionId,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
    return { sessionId };
  }

  async rotateRefreshToken(input: {
    digest: string;
    nextDigest: string;
    nextExpiresAt: Date;
    now: Date;
  }): Promise<RotateRefreshResult> {
    const token = this.refreshTokens.get(input.digest);
    if (token === undefined) return { status: 'INVALID' };
    const session = this.sessions.get(token.sessionId)!;
    if (token.usedAt !== null) {
      session.revokedAt = input.now;
      return { status: 'REUSED' };
    }
    if (
      session.revokedAt !== null ||
      token.expiresAt <= input.now ||
      session.expiresAt <= input.now
    ) {
      return { status: 'INVALID' };
    }
    token.usedAt = input.now;
    session.expiresAt = input.nextExpiresAt;
    this.refreshTokens.set(input.nextDigest, {
      sessionId: session.id,
      expiresAt: input.nextExpiresAt,
      usedAt: null,
    });
    return {
      status: 'ROTATED',
      userId: session.userId,
      sessionId: session.id,
      expiresAt: input.nextExpiresAt,
    };
  }

  async revokeSession(userId: string, sessionId: string, now: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.userId === userId) session.revokedAt = now;
  }

  async isSessionActive(userId: string, sessionId: string, now: Date): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    return (
      session !== undefined &&
      session.userId === userId &&
      session.revokedAt === null &&
      session.expiresAt > now
    );
  }

  async findProviderForUser(userId: string): Promise<OAuthProviderName | null> {
    return (
      [...this.identities.values()].find((identity) => identity.userId === userId)?.provider ?? null
    );
  }

  refreshTokenDigests(): string[] {
    return [...this.refreshTokens.keys()];
  }
}

export class MemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, ProfileRecord>();

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    return this.profiles.get(userId) ?? null;
  }

  async upsert(userId: string, profile: ProfileData, completedAt: Date): Promise<ProfileRecord> {
    const saved = { userId, ...profile, completedAt };
    this.profiles.set(userId, saved);
    return saved;
  }
}

export class FakeOAuthProviderRegistry implements OAuthProviderRegistry {
  async exchange(
    provider: OAuthProviderName,
    input: OAuthExchangeInput,
  ): Promise<ProviderIdentity> {
    if (input.authorizationCode === 'cancel') {
      throw new AuthError('AUTH_CODE_REJECTED', 'Authorization was cancelled');
    }
    if (input.authorizationCode === 'unavailable') {
      throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 'Provider is unavailable');
    }
    if (input.authorizationCode === 'timeout') {
      throw new AuthError('AUTH_PROVIDER_TIMEOUT', 'Provider timed out');
    }
    return {
      provider,
      issuer:
        provider === 'GOOGLE'
          ? 'https://accounts.google.com'
          : 'https://open.weixin.qq.com/unionid',
      subject: input.authorizationCode,
      suggestedProfile: {
        displayName: 'Suggested only',
        avatarUrl: 'https://example.com/avatar.png',
      },
    };
  }
}

export class MemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly memberships = new Map<string, RoomMembershipRecord[]>();

  async createWithHost(input: CreateRoomRepositoryInput): Promise<RoomDetail> {
    const membership: RoomMembershipRecord = {
      id: input.hostMembershipId,
      roomId: input.id,
      userId: input.hostUserId,
      role: 'HOST',
      joinOrder: 1,
      rulesVersion: input.rulesVersion,
      rulesAcceptedAt: input.startedAt,
      joinedAt: input.startedAt,
    };
    const room: RoomRecord = {
      id: input.id,
      hostUserId: input.hostUserId,
      hostDisplayName: `Host ${input.hostUserId.slice(0, 8)}`,
      topic: input.topic,
      cefrLevel: input.cefrLevel,
      capacity: input.capacity,
      passwordDigest: input.passwordDigest,
      status: 'OPEN',
      startedAt: input.startedAt,
      endsAt: input.endsAt,
      memberCount: 1,
    };
    this.rooms.set(room.id, room);
    this.memberships.set(room.id, [membership]);
    return { room: { ...room }, currentMembership: { ...membership } };
  }

  async listOpen(input: Parameters<RoomRepository['listOpen']>[0]): Promise<RoomListPage> {
    const sorted = [...this.rooms.values()]
      .filter((room) => room.status === 'OPEN' && room.endsAt > input.now)
      .sort(
        (left, right) =>
          right.startedAt.getTime() - left.startedAt.getTime() || right.id.localeCompare(left.id),
      );
    const afterCursor =
      input.cursor === null
        ? sorted
        : sorted.filter(
            (room) =>
              room.startedAt < input.cursor!.startedAt ||
              (room.startedAt.getTime() === input.cursor!.startedAt.getTime() &&
                room.id < input.cursor!.id),
          );
    const page = afterCursor.slice(0, input.limit);
    return {
      items: page.map((room) => ({ ...room })),
      nextCursor:
        afterCursor.length > input.limit && page.length > 0
          ? { startedAt: page.at(-1)!.startedAt, id: page.at(-1)!.id }
          : null,
    };
  }

  async findDetail(roomId: string, userId: string): Promise<RoomDetail | null> {
    const room = this.rooms.get(roomId);
    if (room === undefined) return null;
    return {
      room: { ...room, memberCount: this.memberships.get(roomId)?.length ?? 0 },
      currentMembership:
        this.memberships.get(roomId)?.find((membership) => membership.userId === userId) ?? null,
    };
  }

  async withLockedRoom<T>(
    roomId: string,
    userId: string,
    operation: (locked: LockedRoom) => Promise<T>,
  ): Promise<T | null> {
    const room = this.rooms.get(roomId);
    const memberships = this.memberships.get(roomId);
    if (room === undefined || memberships === undefined) return null;
    const maximum = memberships.reduce(
      (value, membership) => Math.max(value, membership.joinOrder),
      0,
    );
    return operation({
      room: { ...room, memberCount: memberships.length },
      existingMembership: memberships.find((membership) => membership.userId === userId) ?? null,
      nextJoinOrder: maximum + 1,
      createMembership: async (input) => {
        const membership: RoomMembershipRecord = {
          id: input.id,
          roomId,
          userId: input.userId,
          role: 'MEMBER',
          joinOrder: maximum + 1,
          rulesVersion: input.rulesVersion,
          rulesAcceptedAt: input.now,
          joinedAt: input.now,
        };
        memberships.push(membership);
        room.memberCount = memberships.length;
        return { ...membership };
      },
    });
  }

  clear(): void {
    this.rooms.clear();
    this.memberships.clear();
  }

  expire(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room !== undefined) room.endsAt = new Date(0);
  }
}
