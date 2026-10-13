import type { SloganApiPaths } from '@slogan/api-client';
import { createMobileApiClient } from '../../api/client';
import { RoomApiError, type AuthorizedRequest } from '../room-discovery';
import type { MessageKey } from '../../services/locale';
type Paths = SloganApiPaths;
export type Conversation =
  Paths['/v1/conversations/{conversationId}']['get']['responses'][200]['content']['application/json'];
export type ConversationPage =
  Paths['/v1/me/conversations']['get']['responses'][200]['content']['application/json'];
export type DirectMessage =
  Paths['/v1/conversations/{conversationId}/messages']['post']['responses'][201]['content']['application/json'];
export type DirectCall =
  Paths['/v1/direct-calls/{callId}']['get']['responses'][200]['content']['application/json'];
export type CallCredentials =
  Paths['/v1/direct-calls/{callId}/credentials']['post']['responses'][200]['content']['application/json'];
export function directError(error: unknown): MessageKey {
  const code = error instanceof RoomApiError ? error.code : '';
  if (code === 'DIRECT_CALL_BUSY' || code === 'ROOM_VOICE_BUSY') return 'directCallBusy';
  if (code === 'DIRECT_TARGET_UNAVAILABLE' || code === 'DIRECT_CALL_UNAVAILABLE')
    return 'directUnavailable';
  if (code === 'DIRECT_RATE_LIMITED' || code === 'RATE_LIMITED') return 'directRateLimited';
  return 'directLoadFailed';
}
export class DirectApi {
  constructor(
    private readonly authorized: AuthorizedRequest,
    private readonly client = createMobileApiClient(),
  ) {}
  private async invoke<T>(
    operation: (token: string) => Promise<{ data?: T; error?: unknown; response: Response }>,
  ): Promise<T> {
    const result = await this.authorized(operation).catch(() => {
      throw new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!result.data) {
      const error = result.error;
      throw new RoomApiError(
        result.response.status,
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : 'DIRECT_FAILED',
      );
    }
    return result.data;
  }
  open(targetUserId: string) {
    return this.invoke((token) =>
      this.client.POST('/v1/conversations', {
        headers: { Authorization: `Bearer ${token}` },
        body: { targetUserId },
      }),
    );
  }
  unread() {
    return this.invoke((token) =>
      this.client.GET('/v1/me/conversations/unread', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }
  conversations(cursor?: string) {
    return this.invoke((token) =>
      this.client.GET('/v1/me/conversations', {
        headers: { Authorization: `Bearer ${token}` },
        params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      }),
    );
  }
  detail(conversationId: string) {
    return this.invoke((token) =>
      this.client.GET('/v1/conversations/{conversationId}', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId } },
      }),
    );
  }
  messages(conversationId: string, cursor?: string) {
    return this.invoke((token) =>
      this.client.GET('/v1/conversations/{conversationId}/messages', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId }, query: { limit: 50, ...(cursor ? { cursor } : {}) } },
      }),
    );
  }
  callHistory(conversationId: string, cursor?: string) {
    return this.invoke((token) =>
      this.client.GET('/v1/conversations/{conversationId}/calls', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId }, query: { limit: 50, ...(cursor ? { cursor } : {}) } },
      }),
    );
  }
  send(conversationId: string, text: string, clientRequestId: string) {
    return this.invoke((token) =>
      this.client.POST('/v1/conversations/{conversationId}/messages', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId } },
        body: { text, clientRequestId },
      }),
    );
  }
  read(conversationId: string, sequence: number) {
    return this.invoke((token) =>
      this.client.POST('/v1/conversations/{conversationId}/read', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId } },
        body: { sequence },
      }),
    );
  }
  hide(conversationId: string, clientRequestId: string) {
    return this.invoke((token) =>
      this.client.DELETE('/v1/conversations/{conversationId}', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId } },
        body: { clientRequestId },
      }),
    );
  }
  report(conversationId: string, messageId: string, description: string, clientRequestId: string) {
    return this.invoke((token) =>
      this.client.POST('/v1/conversations/{conversationId}/messages/{messageId}/report', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId, messageId } },
        body: { category: 'OTHER', description, clientRequestId },
      }),
    );
  }
  requestCall(conversationId: string, clientRequestId: string) {
    return this.invoke((token) =>
      this.client.POST('/v1/conversations/{conversationId}/calls', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { conversationId } },
        body: { clientRequestId },
      }),
    );
  }
  calls() {
    return this.invoke((token) =>
      this.client.GET('/v1/me/direct-calls', { headers: { Authorization: `Bearer ${token}` } }),
    );
  }
  call(callId: string) {
    return this.invoke((token) =>
      this.client.GET('/v1/direct-calls/{callId}', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { callId } },
      }),
    );
  }
  callAction(callId: string, action: 'accept' | 'reject' | 'end', clientRequestId: string) {
    return this.invoke((token) =>
      this.client.POST(`/v1/direct-calls/{callId}/${action}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { callId } },
        body: { clientRequestId },
      }),
    );
  }
  heartbeat(callId: string) {
    return this.invoke((token) =>
      this.client.POST('/v1/direct-calls/{callId}/heartbeat', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { callId } },
      }),
    );
  }
  credentials(callId: string) {
    return this.invoke((token) =>
      this.client.POST('/v1/direct-calls/{callId}/credentials', {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: { callId } },
      }),
    );
  }
}
