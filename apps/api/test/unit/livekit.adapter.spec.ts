import { ConfigService } from '@nestjs/config';
import { TokenVerifier } from 'livekit-server-sdk';
const jest = import.meta.jest;
import type { Environment } from '../../src/config/environment.js';
import { LivekitAdapter } from '../../src/infrastructure/livekit/livekit.adapter.js';
import { realtimeEnvironment, signedWebhook } from '../fixtures/realtime.js';

describe('LiveKit Cloud adapter', () => {
  const environment = realtimeEnvironment();
  const adapter = () => new LivekitAdapter(new ConfigService<Environment, true>(environment));
  it('signs opaque, scoped microphone-only credentials with a bounded lifetime', async () => {
    const issued = await adapter().token('room-id', 'identity-id', 300);
    const claims = await new TokenVerifier(
      environment.LIVEKIT_API_KEY!,
      environment.LIVEKIT_API_SECRET!,
    ).verify(issued.token);
    expect(claims.sub).toBe('identity-id');
    expect(claims.video).toEqual({
      room: 'room-room-id',
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: ['microphone'],
      canPublishData: false,
      canUpdateOwnMetadata: false,
      roomAdmin: false,
      roomCreate: false,
      roomRecord: false,
      roomList: false,
    });
    expect(issued.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(300_000);
    expect(issued.expiresAt.getTime() - Date.now()).toBeGreaterThan(298_000);
    expect(claims).not.toHaveProperty('name');
    expect(claims).not.toHaveProperty('metadata');
  });
  it('verifies the original webhook bytes and rejects missing or tampered signatures', async () => {
    const body = JSON.stringify({
      event: 'participant_joined',
      id: 'event-1',
      createdAt: Math.floor(Date.now() / 1000),
      room: { name: 'room-id', sid: 'RM_1' },
      participant: { identity: 'identity', sid: 'PA_1' },
    });
    const signature = await signedWebhook(body);
    await expect(adapter().verifyWebhook(body, signature)).resolves.toMatchObject({
      id: 'event-1',
      type: 'joined',
      identity: 'identity',
    });
    await expect(adapter().verifyWebhook(body + ' ', signature)).rejects.toMatchObject({
      code: 'REALTIME_WEBHOOK_INVALID',
    });
    await expect(adapter().verifyWebhook(body, '')).rejects.toMatchObject({
      code: 'REALTIME_WEBHOOK_INVALID',
    });
  });
  it('sends an explicit cutoff including same-second tokens and never accepts a failed revocation', async () => {
    const value = adapter();
    const remove = jest
      .fn<Promise<void>, [string, string, { revokeTokenTs: bigint }]>()
      .mockResolvedValue(undefined);
    Object.assign(value, { client: { removeParticipant: remove } });
    const before = Math.floor(Date.now() / 1000);
    await value.revoke('test', 'old-identity');
    const args = remove.mock.calls[0]!;
    expect(args[0]).toBe('room-test');
    expect(args[1]).toBe('old-identity');
    expect(Number(args[2].revokeTokenTs)).toBeGreaterThanOrEqual(before + 1);
    expect(Number(args[2].revokeTokenTs)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
    remove.mockRejectedValue(
      Object.assign(new Error('secret-provider-message'), { code: 'not_found' }),
    );
    await expect(value.revoke('test', 'offline-identity')).rejects.toMatchObject({
      code: 'REALTIME_PROVIDER_UNAVAILABLE',
      message: 'Realtime provider is unavailable',
    });
  });
  it('treats repeated room deletion as idempotent but preserves provider failures', async () => {
    const value = adapter();
    const deletion = jest.fn<Promise<void>, []>().mockRejectedValue({ code: 'not_found' });
    Object.assign(value, { client: { deleteRoom: deletion } });
    await expect(value.deleteRoom('test')).resolves.toBeUndefined();
    deletion.mockRejectedValue({ code: 'unavailable' });
    await expect(value.deleteRoom('test')).rejects.toMatchObject({
      code: 'REALTIME_PROVIDER_UNAVAILABLE',
    });
  });
  it('checks an existing provider room capacity before issuing room access', async () => {
    const value = adapter();
    const list = jest
      .fn<Promise<Array<{ sid: string; maxParticipants: number; metadata: string }>>, []>()
      .mockResolvedValue([{ sid: 'RM_1', maxParticipants: 4, metadata: '{"schemaVersion":1}' }]);
    Object.assign(value, { client: { listRooms: list } });
    await expect(value.ensureRoom('test', 4, '{"schemaVersion":1}')).resolves.toBe('RM_1');
    await expect(value.ensureRoom('test', 6, '{"schemaVersion":1}')).rejects.toMatchObject({
      code: 'REALTIME_PROVIDER_UNAVAILABLE',
    });
  });

  it('writes metadata on create and updates an existing room only when needed', async () => {
    const value = adapter();
    const listRooms = jest
      .fn<Promise<Array<{ sid: string; maxParticipants: number; metadata: string }>>, []>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ sid: 'RM_1', maxParticipants: 4, metadata: 'old' }]);
    const createRoom = jest.fn(async (input: { metadata?: string }) => ({
      sid: 'RM_created',
      metadata: input.metadata,
    }));
    const updateRoomMetadata = jest.fn(async () => ({ sid: 'RM_1' }));
    Object.assign(value, { client: { listRooms, createRoom, updateRoomMetadata } });
    await expect(value.ensureRoom('test', 4, 'latest')).resolves.toBe('RM_created');
    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({ metadata: 'latest' }));
    await expect(value.ensureRoom('test', 4, 'latest')).resolves.toBe('RM_1');
    expect(updateRoomMetadata).toHaveBeenCalledWith('room-test', 'latest');
  });

  it('maps room metadata updates to updated, not found and unavailable', async () => {
    const value = adapter();
    const update = jest.fn<Promise<object>, [string, string]>().mockResolvedValue({});
    Object.assign(value, { client: { updateRoomMetadata: update } });
    await expect(value.updateRoomMetadata('test', 'latest')).resolves.toBe('UPDATED');
    update.mockRejectedValueOnce({ code: 'not_found' });
    await expect(value.updateRoomMetadata('test', 'latest')).resolves.toBe('NOT_FOUND');
    update.mockRejectedValueOnce(new Error('provider secret'));
    await expect(value.updateRoomMetadata('test', 'latest')).rejects.toMatchObject({
      code: 'REALTIME_PROVIDER_UNAVAILABLE',
    });
  });
});
