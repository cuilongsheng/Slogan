import { RoomApiError } from '../room-discovery/api';
import { VoiceRoomApi } from './api';

describe('voice room API', () => {
  it('reads current-host safety alerts with the generated path and cursor', async () => {
    const page = { items: [], nextCursor: null };
    const client = { GET: jest.fn(async () => ({ data: page, response: { status: 200 } })) };
    const authorize = jest.fn(async (request) => request('access-token'));
    const api = new VoiceRoomApi(authorize, client as never);
    await expect(api.safetyAlerts('room-1', 'next-page')).resolves.toBe(page);
    expect(client.GET).toHaveBeenCalledWith('/v1/rooms/{roomId}/safety-alerts', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' }, query: { limit: 20, cursor: 'next-page' } },
    });
  });
  it('uses the server contract without exposing the password in the URL', async () => {
    const client = {
      POST: jest
        .fn()
        .mockResolvedValueOnce({
          data: { currentMembership: { id: 'member-1' } },
          response: { status: 201 },
        })
        .mockResolvedValueOnce({
          data: { participantToken: 'private-token' },
          response: { status: 200 },
        })
        .mockResolvedValueOnce({ data: { lifecycle: 'LEFT' }, response: { status: 200 } })
        .mockResolvedValueOnce({ data: { roomStatus: 'ENDED' }, response: { status: 200 } }),
      GET: jest.fn().mockResolvedValue({ data: [], response: { status: 200 } }),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    const api = new VoiceRoomApi(authorize, client as never);

    await api.join('room-1', { rulesAccepted: true, password: '1234' });
    expect(client.POST).toHaveBeenNthCalledWith(1, '/v1/rooms/{roomId}/memberships', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' } },
      body: { rulesAccepted: true, password: '1234' },
    });
    await api.credentials('room-1');
    await api.members('room-1');
    await api.leave('room-1', 2);
    expect(client.POST).toHaveBeenNthCalledWith(3, '/v1/rooms/{roomId}/leave', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' } },
      body: { expectedCredentialVersion: 2 },
    });
    await api.end('room-1');
    expect(client.POST).toHaveBeenNthCalledWith(4, '/v1/rooms/{roomId}/end', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' } },
    });
  });

  it('preserves stable server errors without returning secret response details', async () => {
    const client = {
      POST: jest.fn().mockResolvedValue({
        error: { code: 'ROOM_PASSWORD_INVALID', message: 'Secret should not appear' },
        response: { status: 409 },
      }),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    await expect(
      new VoiceRoomApi(authorize, client as never).join('room-1', {
        rulesAccepted: true,
        password: '1234',
      }),
    ).rejects.toEqual(new RoomApiError(409, 'ROOM_PASSWORD_INVALID'));
  });

  it('honors committed leave and end results when provider cleanup returns 503', async () => {
    const committed = {
      roomId: 'room-1',
      membershipId: 'member-1',
      hostUserId: 'host-1',
      lifecycle: 'LEFT',
      credentialVersion: 4,
      roomStatus: 'OPEN',
      providerStatus: 'UNAVAILABLE',
    };
    const client = {
      POST: jest
        .fn()
        .mockResolvedValueOnce({
          error: { code: 'REALTIME_PROVIDER_UNAVAILABLE', details: committed },
          response: { status: 503 },
        })
        .mockResolvedValueOnce({
          error: {
            code: 'REALTIME_PROVIDER_UNAVAILABLE',
            details: { ...committed, roomStatus: 'ENDING' },
          },
          response: { status: 503 },
        }),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    const api = new VoiceRoomApi(authorize, client as never);
    await expect(api.leave('room-1', 3)).resolves.toMatchObject({ lifecycle: 'LEFT' });
    await expect(api.end('room-1')).resolves.toMatchObject({ roomStatus: 'ENDING' });
  });

  it('does not treat an unrelated provider error as a committed action', async () => {
    const client = {
      POST: jest.fn().mockResolvedValue({
        error: {
          code: 'REALTIME_PROVIDER_UNAVAILABLE',
          details: { roomId: 'other-room', roomStatus: 'ENDED' },
        },
        response: { status: 503 },
      }),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    await expect(new VoiceRoomApi(authorize, client as never).leave('room-1', 3)).rejects.toEqual(
      new RoomApiError(503, 'REALTIME_PROVIDER_UNAVAILABLE'),
    );
  });

  it('submits the observed member generation and an unchanged report request ID', async () => {
    const client = {
      POST: jest
        .fn()
        .mockResolvedValueOnce({ data: { lifecycle: 'REMOVED' }, response: { status: 200 } })
        .mockResolvedValueOnce({
          data: { id: 'report-1', caseId: 'case-1', submittedAt: '2026-09-28T00:00:00Z' },
          response: { status: 201 },
        }),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    const api = new VoiceRoomApi(authorize, client as never);
    const member = {
      membershipId: 'member-2',
      userId: 'user-2',
      credentialVersion: 4,
    };
    await api.removeMember('room-1', member as never);
    expect(client.POST).toHaveBeenNthCalledWith(
      1,
      '/v1/rooms/{roomId}/members/{membershipId}/removals',
      {
        headers: { Authorization: 'Bearer access-token' },
        params: { path: { roomId: 'room-1', membershipId: 'member-2' } },
        body: { expectedCredentialVersion: 4 },
      },
    );
    await api.report('room-1', {
      targetUserId: 'user-2',
      category: 'HARASSMENT_ABUSE',
      description: 'Behavior details',
      clientRequestId: 'request-1',
    });
    expect(client.POST).toHaveBeenNthCalledWith(2, '/v1/rooms/{roomId}/reports', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' } },
      body: {
        targetUserId: 'user-2',
        category: 'HARASSMENT_ABUSE',
        description: 'Behavior details',
        clientRequestId: 'request-1',
      },
    });
  });

  it('submits room extension with the caller-provided idempotency key', async () => {
    const client = {
      POST: jest.fn().mockResolvedValue({
        data: { roomId: 'room-1', endsAt: '2026-09-28T10:00:00Z', providerStatus: 'PENDING' },
        response: { status: 200 },
      }),
    };
    const authorize = jest.fn(async (request) => request('access-token'));
    const api = new VoiceRoomApi(authorize, client as never);
    await expect(api.extend('room-1', 15, 'request-1')).resolves.toMatchObject({
      providerStatus: 'PENDING',
    });
    expect(client.POST).toHaveBeenCalledWith('/v1/rooms/{roomId}/extensions', {
      headers: { Authorization: 'Bearer access-token' },
      params: { path: { roomId: 'room-1' } },
      body: { additionalMinutes: 15, clientRequestId: 'request-1' },
    });
  });
});
