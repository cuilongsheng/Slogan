import type { SloganApiPaths } from '@slogan/api-client';
import { createMobileApiClient } from '../../api/client';

type Client = ReturnType<typeof createMobileApiClient>;
export type InstantRoomInput =
  SloganApiPaths['/v1/rooms']['post']['requestBody']['content']['application/json'];
export type ScheduledRoomInput =
  SloganApiPaths['/v1/appointment-rooms']['post']['requestBody']['content']['application/json'];
type Authorized = <T extends { response: Response }>(
  request: (accessToken: string) => Promise<T>,
) => Promise<T>;

export class CreateRoomError extends Error {
  constructor(
    public readonly code: string,
    public readonly uncertain = false,
  ) {
    super(code);
  }
}
function codeOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'ROOM_CREATE_FAILED';
}
export class RoomCreationApi {
  constructor(
    private readonly authorized: Authorized,
    private readonly client: Client = createMobileApiClient(),
  ) {}
  async instant(input: InstantRoomInput) {
    let result;
    try {
      result = await this.authorized((token) =>
        this.client.POST('/v1/rooms', {
          headers: { Authorization: `Bearer ${token}` },
          body: input,
        }),
      );
    } catch {
      throw new CreateRoomError('NETWORK_ERROR', true);
    }
    if (!result.data)
      throw new CreateRoomError(codeOf(result.error), result.response.status >= 500);
    return result.data;
  }
  async scheduled(input: ScheduledRoomInput) {
    let result;
    try {
      result = await this.authorized((token) =>
        this.client.POST('/v1/appointment-rooms', {
          headers: { Authorization: `Bearer ${token}` },
          body: input,
        }),
      );
    } catch {
      throw new CreateRoomError('NETWORK_ERROR', true);
    }
    if (!result.data)
      throw new CreateRoomError(codeOf(result.error), result.response.status >= 500);
    return result.data;
  }
  async scheduledDetail(roomId: string) {
    let result;
    try {
      result = await this.authorized((token) =>
        this.client.GET('/v1/appointment-rooms/{roomId}', {
          headers: { Authorization: `Bearer ${token}` },
          params: { path: { roomId } },
        }),
      );
    } catch {
      throw new CreateRoomError('NETWORK_ERROR');
    }
    if (!result.data) throw new CreateRoomError(codeOf(result.error));
    return result.data;
  }
  async cancelScheduled(roomId: string) {
    let result;
    try {
      result = await this.authorized((token) =>
        this.client.POST('/v1/appointment-rooms/{roomId}/cancellations', {
          headers: { Authorization: `Bearer ${token}` },
          params: { path: { roomId } },
        }),
      );
    } catch {
      throw new CreateRoomError('NETWORK_ERROR', true);
    }
    if (!result.data)
      throw new CreateRoomError(codeOf(result.error), result.response.status >= 500);
    return result.data;
  }
}
