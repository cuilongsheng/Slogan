import { PostRoomLearningApi } from './api';

test('uses authenticated summary, filtered list, idempotent import and versioned commands', async () => {
  const authorized = jest.fn(async (request) => request('access-token'));
  const item = { id: 'item-1', kind: 'KEYWORD', text: 'itinerary', note: null, favorite: false, version: 1, createdAt: '', updatedAt: '' };
  const client = {
    GET: jest.fn(async (path) => ({ data: path === '/v1/me/vocabulary-items' ? { items: [item], nextCursor: null } : { roomId: 'room-1', topic: 'Travel', status: 'READY', items: [] }, response: { status: 200 } })),
    POST: jest.fn(async () => ({ data: item, response: { status: 201 } })),
    PUT: jest.fn(async () => ({ data: { ...item, version: 2, favorite: true }, response: { status: 200 } })),
    DELETE: jest.fn(async () => ({ response: { status: 204 } })),
  };
  const api = new PostRoomLearningApi(authorized, client as never);
  expect((await api.summary('room-1')).status).toBe('READY');
  await api.list({ favorite: true, kind: 'KEYWORD' }, 'next-page');
  await api.importItem('summary-item-1', 'stable-request-1');
  await api.update('item-1', 1, { favorite: true });
  await api.remove('item-1', 2);
  expect(client.GET).toHaveBeenCalledWith('/v1/me/vocabulary-items', { headers: { Authorization: 'Bearer access-token' }, params: { query: { limit: 20, favorite: true, kind: 'KEYWORD', cursor: 'next-page' } } });
  expect(client.POST).toHaveBeenCalledWith('/v1/me/vocabulary-items', { headers: { Authorization: 'Bearer access-token' }, body: { sourceSummaryItemId: 'summary-item-1', clientRequestId: 'stable-request-1' } });
  expect(client.PUT).toHaveBeenCalledWith('/v1/me/vocabulary-items/{itemId}', { headers: { Authorization: 'Bearer access-token' }, params: { path: { itemId: 'item-1' } }, body: { expectedVersion: 1, favorite: true } });
  expect(client.DELETE).toHaveBeenCalledWith('/v1/me/vocabulary-items/{itemId}', { headers: { Authorization: 'Bearer access-token' }, params: { path: { itemId: 'item-1' } }, body: { expectedVersion: 2 } });
});

test('returns an API conflict without hiding status', async () => {
  const api = new PostRoomLearningApi((async (request: (token: string) => Promise<unknown>) => request('access-token')) as never, { PUT: jest.fn(async () => ({ response: { status: 409 }, error: { code: 'VOCABULARY_VERSION_CONFLICT' } })) } as never);
  await expect(api.update('item-1', 1, { text: 'Changed' })).rejects.toMatchObject({ status: 409, code: 'VOCABULARY_VERSION_CONFLICT' });
});
