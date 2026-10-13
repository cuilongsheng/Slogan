import { AppState } from 'react-native';
import { startForegroundPolling } from './foregroundPolling';

const initialState = AppState.currentState;

let change!: (state: string) => void;
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
beforeEach(() => {
  jest.useFakeTimers();
  Reflect.set(AppState, 'currentState', null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = (state) => {
      Reflect.set(AppState, 'currentState', state);
      listener(state as never);
    };
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  Reflect.set(AppState, 'currentState', initialState);
});

test('starts while the initial native state is unknown and measures the interval from request start', async () => {
  let finish!: () => void;
  const work = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const stop = startForegroundPolling(work, 5000);
  expect(work).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000);
  finish();
  await flush();
  jest.advanceTimersByTime(3999);
  expect(work).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(work).toHaveBeenCalledTimes(2);
  stop();
  finish();
  await flush();
});

test('fences a pending response on background, then queues one immediate fresh request on resume', async () => {
  let finish!: () => void;
  const fences: Array<() => boolean> = [];
  const work = jest.fn((current: () => boolean) => {
    fences.push(current);
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const stop = startForegroundPolling(work, 5000);
  change('background');
  expect(fences[0]!()).toBe(false);
  change('active');
  change('active');
  expect(work).toHaveBeenCalledTimes(1);
  finish();
  await flush();
  jest.advanceTimersByTime(0);
  expect(work).toHaveBeenCalledTimes(2);
  expect(fences[1]!()).toBe(true);
  stop();
  expect(fences[1]!()).toBe(false);
  finish();
  await flush();
  jest.advanceTimersByTime(30_000);
  expect(work).toHaveBeenCalledTimes(2);
});
