import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

type Paths = SloganApiPaths;
type Client = ReturnType<typeof createMobileApiClient>;
export type KeywordSummary = Paths['/v1/rooms/{roomId}/keyword-summary']['get']['responses'][200]['content']['application/json'];
export type SummaryItem = KeywordSummary['items'][number];
export type VocabularyPage = Paths['/v1/me/vocabulary-items']['get']['responses'][200]['content']['application/json'];
export type VocabularyItem = VocabularyPage['items'][number];
export type VocabularyFilter = { favorite?: boolean; kind?: 'KEYWORD' | 'EXPRESSION' };
export type VocabularyUpdate = { text?: string; note?: string | null; favorite?: boolean };

function failure(status: number, error: unknown): RoomApiError {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code) : status === 0 ? 'NETWORK_ERROR' : 'POST_ROOM_LEARNING_FAILED';
  return new RoomApiError(status, code);
}

export class PostRoomLearningApi {
  constructor(private readonly authorized: AuthorizedRequest, private readonly client: Client = createMobileApiClient()) {}

  async summary(roomId: string): Promise<KeywordSummary> {
    const result = await this.authorized((accessToken) => this.client.GET('/v1/rooms/{roomId}/keyword-summary', {
      headers: { Authorization: `Bearer ${accessToken}` }, params: { path: { roomId } },
    })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }

  async list(filter: VocabularyFilter = {}, cursor?: string): Promise<VocabularyPage> {
    const result = await this.authorized((accessToken) => this.client.GET('/v1/me/vocabulary-items', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { query: { limit: 20, ...filter, ...(cursor ? { cursor } : {}) } },
    })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }

  async importItem(sourceSummaryItemId: string, clientRequestId: string): Promise<VocabularyItem> {
    const result = await this.authorized((accessToken) => this.client.POST('/v1/me/vocabulary-items', {
      headers: { Authorization: `Bearer ${accessToken}` }, body: { sourceSummaryItemId, clientRequestId },
    })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }

  async update(itemId: string, expectedVersion: number, changes: VocabularyUpdate): Promise<VocabularyItem> {
    const result = await this.authorized((accessToken) => this.client.PUT('/v1/me/vocabulary-items/{itemId}', {
      headers: { Authorization: `Bearer ${accessToken}` }, params: { path: { itemId } },
      body: { expectedVersion, ...changes },
    })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }

  async remove(itemId: string, expectedVersion: number): Promise<void> {
    const result = await this.authorized((accessToken) => this.client.DELETE('/v1/me/vocabulary-items/{itemId}', {
      headers: { Authorization: `Bearer ${accessToken}` }, params: { path: { itemId } },
      body: { expectedVersion },
    })).catch(() => { throw failure(0, null); });
    if (result.response.status !== 204) throw failure(result.response.status, result.error);
  }
}
