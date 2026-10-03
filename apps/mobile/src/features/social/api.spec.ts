import { SocialApi } from './api';

test('uses authorized pagination and stable command identifiers', async () => {
  const authorized = jest.fn(async (request) => request('access-token'));
  const client = {
    GET: jest.fn(async () => ({ data: { items: [], nextCursor: null }, response: { status: 200 } })),
    POST: jest.fn(async () => ({ data: { id: 'command-1', status: 'PENDING' }, response: { status: 200 } })),
    DELETE: jest.fn(async () => ({ data: { id: 'relationship-1', endedAt: '2026-09-28T00:00:00.000Z' }, response: { status: 200 } })),
  };
  const api = new SocialApi(authorized, client as never);
  await api.friends('cursor-1');
  await api.requests('incoming', 'cursor-2');
  await api.invitations();
  await api.requestFriend('user-1', 'request-1');
  await api.resolveRequest('friend-request-1', 'accept', 'request-2');
  await api.deleteFriend('user-1', 'request-3');
  await api.declineInvitation('invite-1', 'request-4');
  expect(client.GET).toHaveBeenCalledWith('/v1/friend-requests', { headers: { Authorization: 'Bearer access-token' }, params: { query: { direction: 'incoming', limit: 20, cursor: 'cursor-2' } } });
  expect(client.POST).toHaveBeenCalledWith('/v1/friend-requests', { headers: { Authorization: 'Bearer access-token' }, body: { targetUserId: 'user-1', clientRequestId: 'request-1' } });
  expect(client.POST).toHaveBeenCalledWith('/v1/friend-requests/{requestId}/accept', { headers: { Authorization: 'Bearer access-token' }, params: { path: { requestId: 'friend-request-1' } }, body: { clientRequestId: 'request-2' } });
  expect(client.DELETE).toHaveBeenCalledWith('/v1/me/friends/{userId}', { headers: { Authorization: 'Bearer access-token' }, params: { path: { userId: 'user-1' }, query: { clientRequestId: 'request-3' } } });
  expect(client.POST).toHaveBeenCalledWith('/v1/room-invitations/{invitationId}/decline', { headers: { Authorization: 'Bearer access-token' }, params: { path: { invitationId: 'invite-1' } }, body: { clientRequestId: 'request-4' } });
});
