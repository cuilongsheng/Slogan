import type { SloganApiPaths } from '@slogan/api-client';

import { createMobileApiClient } from '../../api/client';

export type RoomList =
  SloganApiPaths['/v1/rooms']['get']['responses'][200]['content']['application/json'];
export type RoomSummary = RoomList['items'][number];
export type RoomDetail =
  SloganApiPaths['/v1/rooms/{roomId}']['get']['responses'][200]['content']['application/json'];

type Client = ReturnType<typeof createMobileApiClient>;
export type AuthorizedRequest = <T extends { response: Response }>(
  request: (accessToken: string) => Promise<T>,
) => Promise<T>;

export class RoomApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

function roomError(status: number, error: unknown): RoomApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : status === 0 || status >= 500
        ? 'NETWORK_ERROR'
        : 'ROOM_REQUEST_FAILED';
  return new RoomApiError(status, code);
}

export class RoomDiscoveryApi {
  constructor(
    private readonly authorize: AuthorizedRequest,
    private readonly client: Client = createMobileApiClient(),
  ) {}

  async list(cursor?: string): Promise<RoomList> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/rooms', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      }),
    ).catch((error: unknown) => {
      throw error instanceof RoomApiError ? error : new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw roomError(response.status, error);
    return data;
  }

  async detail(roomId: string): Promise<RoomDetail> {
    const { data, error, response } = await this.authorize((accessToken) =>
      this.client.GET('/v1/rooms/{roomId}', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { path: { roomId } },
      }),
    ).catch((error: unknown) => {
      throw error instanceof RoomApiError ? error : new RoomApiError(0, 'NETWORK_ERROR');
    });
    if (!data) throw roomError(response.status, error);
    return data;
  }
}

export class RoomListPager {
  private items: RoomSummary[] = [];
  private nextCursor: string | null = null;
  private generation = 0;
  private nextInFlight: Promise<RoomList> | null = null;

  constructor(private readonly api: Pick<RoomDiscoveryApi, 'list'>) {}

  get snapshot(): RoomList {
    return { items: this.items, nextCursor: this.nextCursor };
  }

  async refresh(): Promise<RoomList> {
    const generation = ++this.generation;
    this.nextInFlight = null;
    const page = await this.api.list();
    if (generation === this.generation) {
      this.items = page.items;
      this.nextCursor = page.nextCursor;
    }
    return this.snapshot;
  }

  async loadMore(): Promise<RoomList> {
    if (!this.nextCursor) return this.snapshot;
    if (this.nextInFlight) return this.nextInFlight;
    const generation = this.generation;
    const cursor = this.nextCursor;
    const pending = this.api
      .list(cursor)
      .then((page) => {
        if (generation === this.generation) {
          const seen = new Set(this.items.map((room) => room.id));
          this.items = [...this.items, ...page.items.filter((room) => !seen.has(room.id))];
          this.nextCursor = page.nextCursor;
        }
        return this.snapshot;
      })
      .finally(() => {
        if (this.nextInFlight === pending) this.nextInFlight = null;
      });
    this.nextInFlight = pending;
    return pending;
  }
}
