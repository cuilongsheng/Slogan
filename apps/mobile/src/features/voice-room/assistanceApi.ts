import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery/api';

type Paths = SloganApiPaths;
export type ExpressionResult =
  Paths['/v1/rooms/{roomId}/expression-assistance/text']['post']['responses'][200]['content']['application/json'];
export type AudioConsent =
  Paths['/v1/me/speech-processing-consents']['get']['responses'][200]['content']['application/json']['items'][number];
type Client = ReturnType<typeof createMobileApiClient>;

function assistanceError(status: number, error: unknown): RoomApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : status === 0 || status >= 500
        ? 'ASSISTANCE_UNAVAILABLE'
        : 'ASSISTANCE_REQUEST_FAILED';
  return new RoomApiError(status, code);
}

export class ExpressionAssistanceApi {
  constructor(
    private readonly authorize: AuthorizedRequest,
    private readonly client: Client = createMobileApiClient(),
  ) {}

  async consent(signal?: AbortSignal): Promise<AudioConsent> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/me/speech-processing-consents', {
        ...(signal ? { signal } : {}),
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw assistanceError(response.status, error);
    const item = data.items.find((entry) => entry.purpose === 'AI_EXPRESSION_AUDIO');
    if (!item) throw new RoomApiError(0, 'ASSISTANCE_CONSENT_UNAVAILABLE');
    return item;
  }

  async acceptConsent(
    currentNoticeVersion: string,
    clientRequestId: string,
  ): Promise<AudioConsent> {
    return this.updateConsent('ACCEPT', currentNoticeVersion, clientRequestId);
  }

  async revokeConsent(
    currentNoticeVersion: string,
    clientRequestId: string,
  ): Promise<AudioConsent> {
    return this.updateConsent('REVOKE', currentNoticeVersion, clientRequestId);
  }

  private async updateConsent(
    action: 'ACCEPT' | 'REVOKE',
    currentNoticeVersion: string,
    clientRequestId: string,
  ): Promise<AudioConsent> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.PUT('/v1/me/speech-processing-consents/ai-expression', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { clientRequestId, action, noticeVersion: currentNoticeVersion },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw assistanceError(response.status, error);
    return data;
  }

  async text(roomId: string, text: string, clientRequestId: string): Promise<ExpressionResult> {
    const result = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/expression-assistance/text', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: { clientRequestId, text },
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!result.data) throw assistanceError(result.response.status, result.error);
    return result.data;
  }

  async audio(
    roomId: string,
    clip: { uri: string; mimeType: string; name: string; formFile: Blob },
    currentNoticeVersion: string,
    clientRequestId: string,
    signal?: AbortSignal,
  ): Promise<ExpressionResult> {
    if (signal?.aborted) throw new Error('ASSISTANCE_CANCELLED');
    const form = new FormData();
    form.append('clientRequestId', clientRequestId);
    form.append('noticeVersion', currentNoticeVersion);
    form.append('noticeConfirmed', 'true');
    form.append('audio', clip.formFile, clip.name);
    const result = await this.authorize((accessToken) =>
      this.client.POST('/v1/rooms/{roomId}/expression-assistance/audio', {
        ...(signal ? { signal } : {}),
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
        body: {
          clientRequestId,
          noticeVersion: currentNoticeVersion,
          noticeConfirmed: true,
          audio: clip.uri,
        },
        bodySerializer: () => form,
      }),
    ).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!result.data) throw assistanceError(result.response.status, result.error);
    return result.data;
  }
}
