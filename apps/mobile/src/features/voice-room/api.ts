import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

export type JoinedRoom =
  SloganApiPaths['/v1/rooms/{roomId}/memberships']['post']['responses'][201]['content']['application/json'];
export type RealtimeCredential =
  SloganApiPaths['/v1/rooms/{roomId}/realtime-credentials']['post']['responses'][200]['content']['application/json'];
export type RoomMember =
  SloganApiPaths['/v1/rooms/{roomId}/members']['get']['responses'][200]['content']['application/json'][number];
export type LeaveResult =
  SloganApiPaths['/v1/rooms/{roomId}/leave']['post']['responses'][200]['content']['application/json'];
export type EndResult =
  SloganApiPaths['/v1/rooms/{roomId}/end']['post']['responses'][200]['content']['application/json'];
export type ReportInput =
  SloganApiPaths['/v1/rooms/{roomId}/reports']['post']['requestBody']['content']['application/json'];
export type AvailablePerson =
  SloganApiPaths['/v1/people/available']['get']['responses'][200]['content']['application/json']['items'][number];
export type RemovedMember =
  SloganApiPaths['/v1/rooms/{roomId}/removed-members']['get']['responses'][200]['content']['application/json'][number];
export type RoomSafetyAlertPage =
  SloganApiPaths['/v1/rooms/{roomId}/safety-alerts']['get']['responses'][200]['content']['application/json'];
export type RoomSafetyAlert = RoomSafetyAlertPage['items'][number];

type Client = ReturnType<typeof createMobileApiClient>;

function asApiError(status: number, error: unknown): RoomApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : status === 0 || status >= 500
        ? 'NETWORK_ERROR'
        : 'ROOM_REQUEST_FAILED';
  return new RoomApiError(status, code);
}

function committedResult<T extends LeaveResult | EndResult>(
  roomId: string,
  error: unknown,
): T | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  if (error.code !== 'REALTIME_PROVIDER_UNAVAILABLE' || !('details' in error)) return null;
  const result = error.details;
  if (typeof result !== 'object' || result === null) return null;
  if (
    !('roomId' in result) ||
    result.roomId !== roomId ||
    !('providerStatus' in result) ||
    result.providerStatus !== 'UNAVAILABLE' ||
    !('roomStatus' in result) ||
    !['OPEN', 'ENDING', 'ENDED'].includes(String(result.roomStatus)) ||
    !('lifecycle' in result) ||
    !['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'].includes(String(result.lifecycle)) ||
    !('credentialVersion' in result) ||
    typeof result.credentialVersion !== 'number'
  )
    return null;
  return result as T;
}

export type RoomTextMessage =
  SloganApiPaths['/v1/rooms/{roomId}/messages']['post']['responses'][200]['content']['application/json'];

export class VoiceRoomApi {
  constructor(
    private readonly authorize: AuthorizedRequest,
    private readonly client: Client = createMobileApiClient(),
  ) {}

  async messages(roomId: string, cursor?: string, signal?: AbortSignal) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/rooms/{roomId}/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId }, query: { ...(cursor ? { cursor } : {}) } },
        ...(signal ? { signal } : {}),
      }),
    );
    if (!data) throw asApiError(response.status, error);
    return data;
  }
  async sendMessage(
    roomId: string,
    text: string,
    clientRequestId: string,
  ): Promise<RoomTextMessage> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/messages', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: { text, clientRequestId },
      }),
    );
    if (!data) throw asApiError(response.status, error);
    return data;
  }
  async join(
    roomId: string,
    input: { rulesAccepted: true; password?: string; invitationId?: string },
  ): Promise<JoinedRoom> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/memberships', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: input,
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async credentials(roomId: string): Promise<RealtimeCredential> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/realtime-credentials', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async members(roomId: string): Promise<RoomMember[]> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/rooms/{roomId}/members', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async safetyAlerts(roomId: string, cursor?: string): Promise<RoomSafetyAlertPage> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/rooms/{roomId}/safety-alerts', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId }, query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async leave(
    roomId: string,
    expectedCredentialVersion: number,
    successorMembershipId?: string,
  ): Promise<LeaveResult> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/leave', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: {
          expectedCredentialVersion,
          ...(successorMembershipId ? { successorMembershipId } : {}),
        },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) {
      const committed = committedResult<LeaveResult>(roomId, error);
      if (
        committed &&
        (['LEFT', 'REMOVED'].includes(committed.lifecycle) || committed.roomStatus === 'ENDED')
      )
        return committed;
      throw asApiError(response.status, error);
    }
    return data;
  }

  async end(roomId: string): Promise<EndResult> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/end', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) {
      const committed = committedResult<EndResult>(roomId, error);
      if (committed && ['ENDING', 'ENDED'].includes(committed.roomStatus)) return committed;
      throw asApiError(response.status, error);
    }
    return data;
  }

  async removeMember(roomId: string, member: RoomMember) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/members/{membershipId}/removals', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId, membershipId: member.membershipId } },
        body: { expectedCredentialVersion: member.credentialVersion },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async removedMembers(roomId: string): Promise<RemovedMember[]> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/rooms/{roomId}/removed-members', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async reinviteRemoved(roomId: string, member: RemovedMember) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/members/{membershipId}/invitations', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId, membershipId: member.membershipId } },
        body: { expectedCredentialVersion: member.credentialVersion },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async availablePeople(cursor?: string) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/people/available', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { query: { limit: 50, ...(cursor ? { cursor } : {}) } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async friends(cursor?: string) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/me/friends', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { query: { limit: 50, ...(cursor ? { cursor } : {}) } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async inviteUser(roomId: string, targetUserId: string, clientRequestId: string) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/invitations', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: { targetUserId, clientRequestId },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async extend(roomId: string, additionalMinutes: number, clientRequestId: string) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/extensions', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: { additionalMinutes, clientRequestId },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }

  async report(roomId: string, input: ReportInput) {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/reports', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: input,
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw asApiError(response.status, error);
    return data;
  }
}
