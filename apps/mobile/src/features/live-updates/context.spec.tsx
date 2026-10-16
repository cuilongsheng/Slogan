import { act, render } from '@testing-library/react-native';
import { useCallback } from 'react';
import { AppState, Text, View } from 'react-native';
import { LiveUpdatesProvider, useLiveUpdates } from './context';
import { useForegroundLive } from './hooks';
import { receiveLiveUpdates, type LiveEvent } from './api';
jest.mock('../auth', () => ({ useAuth: () => mockAuth }));
jest.mock('./api', () => ({ receiveLiveUpdates: jest.fn() }));
const mockAuth = {
  state: { kind: 'signedIn', me: { userId: 'account-a', onboardingState: 'ELIGIBLE' } },
  authorized: jest.fn(),
};
const rooms = jest.fn(async () => {}),
  messages = jest.fn(async () => {});
function Consumers() {
  const room = useCallback(() => rooms(), []),
    message = useCallback(() => messages(), []);
  useForegroundLive(room, 'rooms');
  useForegroundLive(message, 'messages');
  return <View />;
}
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});
test('one connection invalidates only its scope and does not periodically refetch unchanged lists', async () => {
  jest.useFakeTimers();
  let event!: (value: LiveEvent, id: string) => void;
  let signal!: AbortSignal;
  (receiveLiveUpdates as jest.Mock).mockImplementation((_auth, abort, _cursor, callback) => {
    event = callback;
    signal = abort;
    return new Promise<void>(() => {});
  });
  const screen = await render(
    <LiveUpdatesProvider>
      <Consumers />
    </LiveUpdatesProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(receiveLiveUpdates).toHaveBeenCalledTimes(1);
  await act(async () => {
    event({ scope: 'reset' }, 'cursor');
    jest.advanceTimersByTime(50);
  });
  const before = [rooms.mock.calls.length, messages.mock.calls.length];
  await act(async () => jest.advanceTimersByTime(20000));
  expect([rooms.mock.calls.length, messages.mock.calls.length]).toEqual(before);
  await act(async () => {
    event({ scope: 'rooms' }, 'next');
    jest.advanceTimersByTime(50);
  });
  expect(rooms).toHaveBeenCalledTimes(before[0]! + 1);
  expect(messages).toHaveBeenCalledTimes(before[1]!);
  await screen.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => event({ scope: 'messages' }, 'late'));
  expect(messages).toHaveBeenCalledTimes(before[1]!);
});

test('background and account changes abort old streams and reject late events', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  const callbacks = new Set<() => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
    const run = () => callback(AppState.currentState);
    callbacks.add(run);
    return { remove: () => callbacks.delete(run) };
  });
  const connections: Array<{ signal: AbortSignal; event: (value: LiveEvent, id: string) => void }> =
    [];
  (receiveLiveUpdates as jest.Mock).mockImplementation((_auth, signal, _cursor, event) => {
    connections.push({ signal, event });
    return new Promise<void>(() => {});
  });
  const tree = () => (
    <LiveUpdatesProvider>
      <Consumers />
    </LiveUpdatesProvider>
  );
  const screen = await render(tree());
  await act(async () => {
    await Promise.resolve();
  });
  expect(connections).toHaveLength(1);
  await act(async () => {
    AppState.currentState = 'background';
    for (const callback of callbacks) callback();
  });
  expect(connections[0]!.signal.aborted).toBe(true);
  const before = messages.mock.calls.length;
  await act(async () => connections[0]!.event({ scope: 'messages' }, 'late-background'));
  expect(messages).toHaveBeenCalledTimes(before);
  await act(async () => {
    AppState.currentState = 'active';
    for (const callback of callbacks) callback();
  });
  expect(connections).toHaveLength(2);
  mockAuth.state.me.userId = 'account-b';
  await screen.rerender(tree());
  await act(async () => {
    await Promise.resolve();
  });
  expect(connections[1]!.signal.aborted).toBe(true);
  expect(connections).toHaveLength(3);
  const switched = messages.mock.calls.length;
  await act(async () => connections[1]!.event({ scope: 'messages' }, 'late-account-a'));
  expect(messages).toHaveBeenCalledTimes(switched);
  await screen.unmount();
  expect(connections[2]!.signal.aborted).toBe(true);
  expect(callbacks.size).toBe(0);
  mockAuth.state.me.userId = 'account-a';
  jest.restoreAllMocks();
});

function StatusProbe() {
  return <Text>{useLiveUpdates().status}</Text>;
}
test('normal lease renewal reconnects without falsely displaying an outage', async () => {
  jest.useFakeTimers();
  let event!: (value: LiveEvent, id: string) => void, finish!: () => void;
  (receiveLiveUpdates as jest.Mock)
    .mockImplementationOnce((_auth, _signal, _cursor, callback) => {
      event = callback;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    })
    .mockImplementation(() => new Promise<void>(() => {}));
  const screen = await render(
    <LiveUpdatesProvider>
      <StatusProbe />
    </LiveUpdatesProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    event({ scope: 'reset' }, 'cursor');
    jest.advanceTimersByTime(50);
  });
  expect(screen.getByText('connected')).toBeTruthy();
  await act(async () => {
    event({ scope: 'renew' }, '');
    finish();
  });
  expect(screen.queryByText('reconnecting')).toBeNull();
  await act(async () => jest.advanceTimersByTime(0));
  expect(receiveLiveUpdates).toHaveBeenCalledTimes(2);
  await screen.unmount();
});

test('resource subscriptions coalesce a burst and retain a newer invalidation during an in-flight read', async () => {
  jest.useFakeTimers();
  let event!: (value: LiveEvent, id: string) => void;
  (receiveLiveUpdates as jest.Mock).mockImplementation((_auth, _signal, _cursor, callback) => {
    event = callback;
    return new Promise<void>(() => {});
  });
  let complete!: () => void;
  const work = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  function Scoped() {
    useForegroundLive(work, ['conversation-history', 'conversation-state'], true, 'conversation-a');
    return null;
  }
  const page = await render(
    <LiveUpdatesProvider>
      <Scoped />
    </LiveUpdatesProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    event({ scope: 'reset' }, 'start');
    jest.advanceTimersByTime(50);
  });
  expect(work).toHaveBeenCalledTimes(1);
  await act(async () => {
    event({ scope: 'conversation-history', resourceId: 'conversation-b' }, 'other');
    jest.advanceTimersByTime(50);
  });
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      event({ scope: 'conversation-history', resourceId: 'conversation-a' }, 'next');
      event({ scope: 'conversation-state', resourceId: 'conversation-a' }, 'next');
    }
    jest.advanceTimersByTime(50);
  });
  expect(work).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete();
    await Promise.resolve();
  });
  expect(work).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(60000));
  expect(work).toHaveBeenCalledTimes(2);
  expect(receiveLiveUpdates).toHaveBeenCalledTimes(1);
  await page.unmount();
});
