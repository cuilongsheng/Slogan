import type { SloganApiPaths } from '@slogan/api-client';
import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

export type PersonalReportPage =
  SloganApiPaths['/v1/me/reports']['get']['responses'][200]['content']['application/json'];
export type PersonalReport = PersonalReportPage['items'][number];
export type ReportSubmissionReceipt =
  SloganApiPaths['/v1/rooms/{roomId}/reports']['post']['responses'][201]['content']['application/json'];
export class ReportingApi {
  constructor(
    private readonly authorize: AuthorizedRequest,
    private readonly client = createMobileApiClient(),
  ) {}
  async list(cursor?: string): Promise<PersonalReportPage> {
    const result = await this.authorize((token) =>
      this.client.GET('/v1/me/reports', {
        headers: { Authorization: `Bearer ${token}` },
        params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!result.data)
      throw new RoomApiError(result.response.status, result.error?.code ?? 'REPORT_REQUEST_FAILED');
    return result.data;
  }
}
