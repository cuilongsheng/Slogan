import { RoomHistoryApi } from './api';

test('uses authenticated history pagination and versioned private notes', async () => {
  const authorized = jest.fn(async (request) => request('access-token'));
  const client = {
    GET: jest.fn(async (path) => path === '/v1/me/room-history'
      ? { data: { items: [], nextCursor: null }, response: { status: 200 } }
      : { data: { content: 'Before', version: 3, updatedAt: '2026-09-28T00:00:00.000Z' }, response: { status: 200 } }),
    PUT: jest.fn(async () => ({ data: { content: '', version: 4, updatedAt: '2026-09-28T00:01:00.000Z' }, response: { status: 200 } })),
  };
  const api = new RoomHistoryApi(authorized, client as never);
  await api.list('next-page');
  await api.note('room-1');
  expect((await api.saveNote('room-1', '', 3)).version).toBe(4);
  expect(client.GET).toHaveBeenCalledWith('/v1/me/room-history', {
    headers: { Authorization: 'Bearer access-token' },
    params: { query: { limit: 20, cursor: 'next-page' } },
  });
  expect(client.GET).toHaveBeenCalledWith('/v1/rooms/{roomId}/note', {
    headers: { Authorization: 'Bearer access-token' },
    params: { path: { roomId: 'room-1' } },
  });
  expect(client.PUT).toHaveBeenCalledWith('/v1/rooms/{roomId}/note', {
    headers: { Authorization: 'Bearer access-token' },
    params: { path: { roomId: 'room-1' } },
    body: { content: '', expectedVersion: 3 },
  });
});

test('preserves a note conflict as a typed API error', async () => {
  const authorized = async (request: (token: string) => Promise<unknown>) => request('access-token');
  const client = {
    PUT: jest.fn(async () => ({ error: { code: 'ROOM_NOTE_VERSION_CONFLICT' }, response: { status: 409 } })),
  };
  const api = new RoomHistoryApi(authorized as never, client as never);
  await expect(api.saveNote('room-1', 'New', 2)).rejects.toMatchObject({ status: 409, code: 'ROOM_NOTE_VERSION_CONFLICT' });
});
