import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

type Paths = SloganApiPaths;
type Client = ReturnType<typeof createMobileApiClient>;
export type HistoryPage = Paths['/v1/me/room-history']['get']['responses'][200]['content']['application/json'];
export type HistoryItem = HistoryPage['items'][number];
export type RoomNote = Paths['/v1/rooms/{roomId}/note']['get']['responses'][200]['content']['application/json'];

function historyError(status: number, error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code) : status === 0 ? 'NETWORK_ERROR' : 'ROOM_HISTORY_FAILED';
  return new RoomApiError(status, code);
}

export class RoomHistoryApi {
  constructor(
    private readonly authorized: AuthorizedRequest,
    private readonly client: Client = createMobileApiClient(),
  ) {}

  async list(cursor?: string): Promise<HistoryPage> {
    const result = await this.authorized((accessToken) => this.client.GET('/v1/me/room-history', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
    })).catch(() => { throw new RoomApiError(0, 'NETWORK_ERROR'); });
    if (!result.data) throw historyError(result.response.status, result.error);
    return result.data;
  }

  async note(roomId: string): Promise<RoomNote> {
    const result = await this.authorized((accessToken) => this.client.GET('/v1/rooms/{roomId}/note', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { path: { roomId } },
    })).catch(() => { throw new RoomApiError(0, 'NETWORK_ERROR'); });
    if (!result.data) throw historyError(result.response.status, result.error);
    return result.data;
  }

  async saveNote(roomId: string, content: string, expectedVersion: number): Promise<RoomNote> {
    const result = await this.authorized((accessToken) => this.client.PUT('/v1/rooms/{roomId}/note', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { path: { roomId } },
      body: { content, expectedVersion },
    })).catch(() => { throw new RoomApiError(0, 'NETWORK_ERROR'); });
    if (!result.data) throw historyError(result.response.status, result.error);
    return result.data;
  }
}
