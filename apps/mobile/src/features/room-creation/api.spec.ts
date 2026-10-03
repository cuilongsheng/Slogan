import { CreateRoomError, RoomCreationApi } from './api';

describe('room creation API', () => {
  const authorize = jest.fn(async (request) => request('access-token'));
  const input = {
    topic: 'Travel',
    cefrLevel: 'B1' as const,
    capacity: 4,
    visibility: 'PUBLIC' as const,
  };
  beforeEach(() => authorize.mockClear());
  it('submits instant and scheduled creations once through the generated client', async () => {
    const client = {
      POST: jest
        .fn()
        .mockResolvedValueOnce({ data: { id: 'room-1' }, response: { status: 201 } })
        .mockResolvedValueOnce({ data: { id: 'appointment-1' }, response: { status: 201 } }),
    };
    const api = new RoomCreationApi(authorize, client as never);
    expect((await api.instant(input)).id).toBe('room-1');
    expect(client.POST).toHaveBeenNthCalledWith(1, '/v1/rooms', {
      headers: { Authorization: 'Bearer access-token' },
      body: input,
    });
    const scheduled = {
      ...input,
      startsAt: '2026-09-29T11:00:00.000Z',
      endsAt: '2026-09-29T12:00:00.000Z',
    };
    expect((await api.scheduled(scheduled)).id).toBe('appointment-1');
    expect(client.POST).toHaveBeenNthCalledWith(2, '/v1/appointment-rooms', {
      headers: { Authorization: 'Bearer access-token' },
      body: scheduled,
    });
  });
  it('marks a lost response as uncertain and does not retry the POST', async () => {
    const client = { POST: jest.fn().mockRejectedValue(new Error('network')) };
    const api = new RoomCreationApi(authorize, client as never);
    await expect(api.instant(input)).rejects.toEqual(new CreateRoomError('NETWORK_ERROR', true));
    expect(client.POST).toHaveBeenCalledTimes(1);
  });
});
