import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

type Paths = SloganApiPaths;
type Client = ReturnType<typeof createMobileApiClient>;
export type RestrictionPage = Paths['/v1/me/safety-restrictions']['get']['responses'][200]['content']['application/json'];
export type Restriction = RestrictionPage['items'][number];
export type Appeal = Paths['/v1/me/safety-restrictions/{restrictionId}/appeal']['post']['responses'][200]['content']['application/json'];

function safetyError(status: number, error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : status === 0 ? 'NETWORK_ERROR' : 'SAFETY_REQUEST_FAILED';
  return new RoomApiError(status, code);
}

export class MySafetyApi {
  constructor(
    private readonly authorized: AuthorizedRequest,
    private readonly client: Client = createMobileApiClient(),
  ) {}

  async list(cursor?: string): Promise<RestrictionPage> {
    const result = await this.authorized((accessToken) =>
      this.client.GET('/v1/me/safety-restrictions', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      }),
    ).catch(() => { throw new RoomApiError(0, 'NETWORK_ERROR'); });
    if (!result.data) throw safetyError(result.response.status, result.error);
    return result.data;
  }

  async appeal(restrictionId: string, reason: string, clientRequestId: string): Promise<Appeal> {
    const result = await this.authorized((accessToken) =>
      this.client.POST('/v1/me/safety-restrictions/{restrictionId}/appeal', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { restrictionId } },
        body: { reason: reason.trim(), clientRequestId },
      }),
    ).catch(() => { throw new RoomApiError(0, 'NETWORK_ERROR'); });
    if (!result.data) throw safetyError(result.response.status, result.error);
    return result.data;
  }
}

export function canAppeal(restriction: Restriction, now = Date.now()) {
  return restriction.status === 'ACTIVE'
    && restriction.appealStatus === null
    && new Date(restriction.startsAt).getTime() <= now
    && now <= new Date(restriction.appealDeadlineAt).getTime()
    && now < new Date(restriction.endsAt).getTime();
}
