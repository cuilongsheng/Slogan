import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../auth';
import { SocialApi } from './api';
import { PresenceHeartbeat } from './PresenceHeartbeat';

jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ SocialApi: jest.fn() }));

const authorized = jest.fn();
const heartbeat = jest.fn();
let change: (state: AppStateStatus) => void;
const remove = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    change = listener;
    return { remove };
  });
  (useAuth as jest.Mock).mockReturnValue({
    authorized,
    state: {
      kind: 'signedIn',
      me: { userId: 'a', onboardingState: 'ELIGIBLE' },
    },
  });
  heartbeat.mockResolvedValue({ refreshAfterSeconds: 60 });
  (SocialApi as jest.Mock).mockImplementation(() => ({ heartbeat }));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('refreshes across routes, stops in background and after logout', async () => {
  const page = await render(<PresenceHeartbeat />);
  expect(heartbeat).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  expect(heartbeat).toHaveBeenCalledTimes(2);
  await act(async () => {
    AppState.currentState = 'background';
    change('background');
    jest.advanceTimersByTime(120_000);
  });
  expect(heartbeat).toHaveBeenCalledTimes(2);
  await act(async () => {
    AppState.currentState = 'active';
    change('active');
  });
  expect(heartbeat).toHaveBeenCalledTimes(3);
  (useAuth as jest.Mock).mockReturnValue({ authorized, state: { kind: 'signedOut' } });
  await page.rerender(<PresenceHeartbeat />);
  await act(async () => {
    jest.advanceTimersByTime(120_000);
  });
  expect(heartbeat).toHaveBeenCalledTimes(3);
  expect(remove).toHaveBeenCalledTimes(1);
});

it('does not start for incomplete or underage profiles', async () => {
  (useAuth as jest.Mock).mockReturnValue({
    authorized,
    state: {
      kind: 'signedIn',
      me: { userId: 'a', onboardingState: 'PROFILE_REQUIRED' },
    },
  });
  await render(<PresenceHeartbeat />);
  expect(heartbeat).not.toHaveBeenCalled();
});

it('does not resume a timer from an old account response', async () => {
  let resolve!: (value: { refreshAfterSeconds: number }) => void;
  heartbeat.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const page = await render(<PresenceHeartbeat />);
  (useAuth as jest.Mock).mockReturnValue({ authorized, state: { kind: 'signedOut' } });
  await page.rerender(<PresenceHeartbeat />);
  await act(async () => {
    resolve({ refreshAfterSeconds: 60 });
  });
  await act(async () => {
    jest.advanceTimersByTime(120_000);
  });
  expect(heartbeat).toHaveBeenCalledTimes(1);
});
