import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

type Paths = SloganApiPaths;
type Client = ReturnType<typeof createMobileApiClient>;
export type ConsentItem = Paths['/v1/me/speech-processing-consents']['get']['responses'][200]['content']['application/json']['items'][number];
export type RoomConsentPurpose = 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS';

function failure(status: number, error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : status === 0 ? 'NETWORK_ERROR' : 'ROOM_CONSENT_FAILED';
  return new RoomApiError(status, code);
}

export class RoomProcessingConsentApi {
  constructor(private readonly authorized: AuthorizedRequest, private readonly client: Client = createMobileApiClient()) {}

  async list(): Promise<ConsentItem[]> {
    const result = await this.authorized((token) => this.client.GET('/v1/me/speech-processing-consents', { headers: { Authorization: `Bearer ${token}` } })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data.items;
  }

  async command(purpose: RoomConsentPurpose, action: 'ACCEPT' | 'REVOKE', noticeVersion: string, clientRequestId: string): Promise<ConsentItem> {
    const path = purpose === 'ROOM_SAFETY_DETECTION' ? '/v1/me/speech-processing-consents/room-safety' as const : '/v1/me/speech-processing-consents/post-room-keywords' as const;
    const result = await this.authorized((token) => this.client.PUT(path, {
      headers: { Authorization: `Bearer ${token}` }, body: { action, noticeVersion, clientRequestId },
    })).catch(() => { throw failure(0, null); });
    if (!result.data) throw failure(result.response.status, result.error);
    return result.data;
  }
}

export function currentConsent(item: ConsentItem | undefined) {
  return item?.status === 'ACCEPTED' && typeof item.noticeVersion === 'string' && item.noticeVersion === item.currentNoticeVersion;
}

export const bundledNoticeVersion = '2026-09-v1';
