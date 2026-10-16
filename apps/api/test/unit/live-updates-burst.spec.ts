import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import { LiveUpdatesService } from '../../src/modules/live-updates/index.js';
import type { SessionService } from '../../src/modules/auth/index.js';
import type { SocialService } from '../../src/modules/social/index.js';
import type {
  LiveUpdatesStore,
  LiveReader,
  StreamChange,
} from '../../src/modules/live-updates/domain/live-updates.port.js';
import { testEnvironment } from '../fixtures/environment.js';

function setup(batches: StreamChange[][]) {
  const controller = new AbortController();
  const identity = { userId: 'owner', sessionId: 'session', expiresAt: Date.now() + 3600000 };
  const reader = {
    read: fn<LiveReader['read']>().mockImplementation(async () => {
      if (batches.length) return batches.shift()!;
      controller.abort();
      return [];
    }),
    close: fn<LiveReader['close']>(),
  };
  const store = {
    dispatch: fn<LiveUpdatesStore['dispatch']>().mockResolvedValue(undefined),
    bounds: fn<LiveUpdatesStore['bounds']>().mockResolvedValue({
      first: ['0-0', '0-0'],
      last: ['0-0', '0-0'],
    }),
    reader: fn<LiveUpdatesStore['reader']>().mockResolvedValue(reader),
    canReceive: fn<LiveUpdatesStore['canReceive']>().mockResolvedValue(true),
  };
  const sessions = {
    streamIdentity: fn<() => Promise<typeof identity>>().mockResolvedValue(identity),
    verifyAccessToken: fn<() => Promise<typeof identity>>().mockResolvedValue(identity),
    isPublicTrialViewer: fn<() => Promise<boolean>>().mockResolvedValue(false),
  };
  const service = new LiveUpdatesService(
    store as unknown as LiveUpdatesStore,
    sessions as unknown as SessionService,
    { assertEligible: async () => undefined } as unknown as SocialService,
    new ConfigService(testEnvironment()),
  );
  return { service, controller, reader, store };
}
function change(id: number, scope: StreamChange['scope'], resourceId = 'conversation') {
  return { index: 1, id: `${id}-0`, scope, resourceId };
}
describe('bounded protocol2 notification bursts', () => {
  it('bounds permission reads by distinct projections and advances over skipped events', async () => {
    const burst = Array.from({ length: 90 }, (_, i) =>
      change(i + 1, ['conversation-history', 'inbox', 'unread'][i % 3] as StreamChange['scope']),
    );
    burst.push(change(91, 'room-safety', 'room'));
    const { service, controller, store, reader } = setup([burst]);
    const frames = [];
    for await (const frame of await service.open('token', undefined, controller.signal, 2))
      frames.push(frame);
    expect(frames.map((f) => f.scope)).toEqual([
      'reset',
      'conversation-history',
      'inbox',
      'unread',
      'room-safety',
    ]);
    expect(store.canReceive).toHaveBeenCalledTimes(4);
    expect(reader.read).toHaveBeenLastCalledWith(['0-0', '91-0']);
    expect(reader.close).toHaveBeenCalledTimes(1);
  });

  it('keeps last-occurrence order, distinct resources and terminal/visibility kinds', async () => {
    const { service, controller } = setup([
      [
        change(1, 'conversation-history'),
        change(2, 'conversation-history', 'other'),
        { ...change(3, 'conversation-history'), kind: 'visibility' },
        change(4, 'conversation-history'),
        { ...change(5, 'room-state', 'room'), kind: 'membership' },
        change(6, 'room-state', 'room'),
      ],
    ]);
    const frames = [];
    for await (const frame of await service.open('token', undefined, controller.signal, 2))
      if (frame.scope !== 'reset') frames.push(frame);
    expect(frames.map((f) => [f.scope, f.resourceId, f.kind])).toEqual([
      ['conversation-history', 'other', undefined],
      ['conversation-history', 'conversation', 'visibility'],
      ['conversation-history', 'conversation', undefined],
      ['room-state', 'room', 'membership'],
      ['room-state', 'room', undefined],
    ]);
    expect(
      frames.map(
        (f) => JSON.parse(Buffer.from(f.id!.split('.')[0]!, 'base64url').toString())[0][1],
      ),
    ).toEqual(['2-0', '3-0', '4-0', '5-0', '6-0']);
  });

  it('rechecks the same resource on a later read after host permissions change', async () => {
    const { service, controller, store } = setup([
      [change(1, 'room-safety', 'room')],
      [
        change(2, 'room-safety', 'room'),
        { ...change(3, 'room-state', 'room'), kind: 'membership' },
      ],
    ]);
    store.canReceive.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const frames = [];
    for await (const frame of await service.open('token', undefined, controller.signal, 2))
      frames.push(frame.scope);
    expect(frames).toEqual(['reset', 'room-safety', 'room-state']);
    expect(store.canReceive).toHaveBeenCalledTimes(3);
  });

  it('preserves every released protocol1 scope frame', async () => {
    const { service, controller, store } = setup([
      [change(1, 'messages'), change(2, 'messages'), change(3, 'conversation-history')],
    ]);
    const frames = [];
    for await (const frame of await service.open('token', undefined, controller.signal))
      frames.push(frame.scope);
    expect(frames).toEqual(['reset', 'messages', 'messages']);
    expect(store.canReceive).not.toHaveBeenCalled();
  });
});
