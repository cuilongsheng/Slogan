import { RoomApiError, RoomDiscoveryApi, RoomListPager, type RoomSummary } from './api';

const room = (id: string): RoomSummary => ({
  id,
  hostUserId: 'host-1',
  hostDisplayName: 'Luna',
  visibility: 'PUBLIC',
  topic: 'Travel',
  cefrLevel: 'B1',
  capacity: 6,
  memberCount: 2,
  hostReconnectDeadline: null,
  passwordProtected: false,
  startedAt: '2026-09-25T10:00:00.000Z',
  endsAt: '2026-09-25T12:00:00.000Z',
  sensitiveSpeechDetectionEnabled: false,
  postRoomKeywordsEnabled: false,
});

describe('room discovery API', () => {
  it('reads the real room list and detail with a bearer token', async () => {
    const client = { GET: jest.fn() };
    client.GET.mockResolvedValueOnce({
      data: { items: [room('room-1')], nextCursor: null },
      response: { status: 200 },
    });
    client.GET.mockResolvedValueOnce({
      data: { ...room('room-1'), currentMembership: null, shareUrl: 'https://example.test/r/1' },
      response: { status: 200 },
    });
    const authorize = jest.fn(async (request) => request('access-token'));
    const api = new RoomDiscoveryApi(authorize, client as never);

    expect((await api.list()).items).toHaveLength(1);
    expect(client.GET).toHaveBeenCalledWith('/v1/rooms', {
      headers: { Authorization: 'Bearer access-token' },
      params: { query: { limit: 20 } },
    });
    expect((await api.detail('room-1')).id).toBe('room-1');
    expect(client.GET).toHaveBeenCalledWith('/v1/rooms/{roomId}', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' } },
    });
  });

  it('keeps a server error code for a unavailable detail', async () => {
    const client = {
      GET: jest.fn(async () => ({
        error: { code: 'ROOM_ENDED' },
        response: { status: 409 },
      })),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    await expect(new RoomDiscoveryApi(authorize, client as never).detail('room-1')).rejects.toEqual(
      new RoomApiError(409, 'ROOM_ENDED'),
    );
  });
});

describe('room list pagination', () => {
  it('handles empty results and deduplicates overlapping cursor pages', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({ items: [room('room-1')], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [room('room-1'), room('room-2')], nextCursor: null });
    const pager = new RoomListPager({ list });

    expect((await pager.refresh()).items).toEqual([]);
    expect((await pager.refresh()).nextCursor).toBe('cursor-1');
    expect((await pager.loadMore()).items.map((item) => item.id)).toEqual(['room-1', 'room-2']);
    expect(list).toHaveBeenLastCalledWith('cursor-1');
    await pager.loadMore();
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('ignores a stale next page after refresh', async () => {
    let releaseNext!: (value: { items: RoomSummary[]; nextCursor: null }) => void;
    const list = jest
      .fn()
      .mockResolvedValueOnce({ items: [room('old')], nextCursor: 'cursor-1' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseNext = resolve;
          }),
      )
      .mockResolvedValueOnce({ items: [room('fresh')], nextCursor: null });
    const pager = new RoomListPager({ list });
    await pager.refresh();
    const stale = pager.loadMore();
    await pager.refresh();
    releaseNext({ items: [room('stale')], nextCursor: null });
    await stale;
    expect(pager.snapshot.items.map((item) => item.id)).toEqual(['fresh']);
  });
});
