import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

type Paths = SloganApiPaths;
type Client = ReturnType<typeof createMobileApiClient>;
export type FriendPage = Paths['/v1/me/friends']['get']['responses'][200]['content']['application/json'];
export type AvailablePage = Paths['/v1/people/available']['get']['responses'][200]['content']['application/json'];
export type RequestPage = Paths['/v1/friend-requests']['get']['responses'][200]['content']['application/json'];
export type BlockPage = Paths['/v1/blocks']['get']['responses'][200]['content']['application/json'];
export type InvitationPage = Paths['/v1/me/room-invitations']['get']['responses'][200]['content']['application/json'];

function failure(status: number, error: unknown): RoomApiError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : status === 0 ? 'NETWORK_ERROR' : 'SOCIAL_FAILED';
  return new RoomApiError(status, code);
}

export class SocialApi {
  constructor(private readonly authorized: AuthorizedRequest, private readonly client: Client = createMobileApiClient()) {}

  async friends(cursor?: string): Promise<FriendPage> {
    const result = await this.authorized((token) => this.client.GET('/v1/me/friends', { headers: { Authorization: `Bearer ${token}` }, params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async available(cursor?: string): Promise<AvailablePage> {
    const result = await this.authorized((token) => this.client.GET('/v1/people/available', { headers: { Authorization: `Bearer ${token}` }, params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async requests(direction: 'incoming' | 'outgoing', cursor?: string): Promise<RequestPage> {
    const result = await this.authorized((token) => this.client.GET('/v1/friend-requests', { headers: { Authorization: `Bearer ${token}` }, params: { query: { direction, limit: 20, ...(cursor ? { cursor } : {}) } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async blocks(cursor?: string): Promise<BlockPage> {
    const result = await this.authorized((token) => this.client.GET('/v1/blocks', { headers: { Authorization: `Bearer ${token}` }, params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async invitations(cursor?: string): Promise<InvitationPage> {
    const result = await this.authorized((token) => this.client.GET('/v1/me/room-invitations', { headers: { Authorization: `Bearer ${token}` }, params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async requestFriend(targetUserId: string, clientRequestId: string) {
    const result = await this.authorized((token) => this.client.POST('/v1/friend-requests', { headers: { Authorization: `Bearer ${token}` }, body: { targetUserId, clientRequestId } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async resolveRequest(requestId: string, action: 'accept' | 'reject' | 'withdraw', clientRequestId: string) {
    const path = `/v1/friend-requests/{requestId}/${action}` as const;
    const result = await this.authorized((token) => this.client.POST(path, { headers: { Authorization: `Bearer ${token}` }, params: { path: { requestId } }, body: { clientRequestId } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async deleteFriend(userId: string, clientRequestId: string) {
    const result = await this.authorized((token) => this.client.DELETE('/v1/me/friends/{userId}', { headers: { Authorization: `Bearer ${token}` }, params: { path: { userId }, query: { clientRequestId } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async block(targetUserId: string, clientRequestId: string) {
    const result = await this.authorized((token) => this.client.POST('/v1/blocks', { headers: { Authorization: `Bearer ${token}` }, body: { targetUserId, clientRequestId } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async unblock(userId: string, clientRequestId: string) {
    const result = await this.authorized((token) => this.client.DELETE('/v1/blocks/{userId}', { headers: { Authorization: `Bearer ${token}` }, params: { path: { userId }, query: { clientRequestId } } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async declineInvitation(invitationId: string, clientRequestId: string) {
    const result = await this.authorized((token) => this.client.POST('/v1/room-invitations/{invitationId}/decline', { headers: { Authorization: `Bearer ${token}` }, params: { path: { invitationId } }, body: { clientRequestId } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
  async heartbeat() {
    const result = await this.authorized((token) => this.client.POST('/v1/me/presence/heartbeat', { headers: { Authorization: `Bearer ${token}` }, body: {} })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
}
