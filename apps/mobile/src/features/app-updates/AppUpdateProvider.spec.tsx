jest.mock('../live-updates', () => jest.requireActual('../../../test/live-updates'));
import type * as ReactTypes from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Text, TouchableOpacity, type AppStateStatus } from 'react-native';
import { AppUpdateProvider, useAppUpdates } from './AppUpdateProvider';

const mockCheck = jest.fn(),
  mockDownload = jest.fn(),
  mockCancel = jest.fn(),
  mockInstall = jest.fn(),
  mockSettings = jest.fn(),
  mockCanInstall = jest.fn();
let mockPath = '/me';
let mockForeground = true;
let mockProgress: ((progress: { bytes: number; total: number }) => void) | undefined;
const mockService = {
  supported: true,
  check: mockCheck,
  download: mockDownload,
  cancel: mockCancel,
  install: mockInstall,
  openSettings: mockSettings,
  canInstall: mockCanInstall,
  onProgress: (listener: typeof mockProgress) => {
    mockProgress = listener;
    return () => {
      mockProgress = undefined;
    };
  },
};
jest.mock('expo-router', () => ({ usePathname: () => mockPath }));
jest.mock('../auth', () => ({ useAuth: () => ({ state: { kind: 'signedIn' } }) }));
jest.mock('../../services/appUpdates', () => ({
  get appUpdates() {
    return mockService;
  },
}));
jest.mock('../../services/foregroundPolling', () => ({ isAppForeground: () => mockForeground }));
jest.mock('../../hooks/useForegroundPolling', () => ({
  useForegroundPolling: (work: () => Promise<void>, _interval: unknown, enabled: boolean) => {
    const React = jest.requireActual('react') as typeof ReactTypes;
    React.useEffect(() => {
      if (enabled) void work();
    }, [work, enabled]);
  },
}));
const release = {
  version: '0.0.81',
  versionCode: 1081,
  commit: 'a'.repeat(40),
  bytes: 85_000_000,
  sha256: 'b'.repeat(64),
  package: 'com.slogan.mobile',
  certificateSha256: 'c'.repeat(64),
  abi: ['arm64-v8a'],
};
function Manual() {
  const updates = useAppUpdates();
  return (
    <TouchableOpacity accessibilityRole="button" onPress={updates.check}>
      <Text>Manual check</Text>
    </TouchableOpacity>
  );
}
const app = () => (
  <AppUpdateProvider>
    <Manual />
  </AppUpdateProvider>
);
beforeEach(() => {
  jest.clearAllMocks();
  mockPath = '/me';
  mockForeground = true;
  mockService.supported = true;
  mockCheck.mockResolvedValue({ installedVersion: '0.0.80', installedVersionCode: 1080, release });
  mockDownload.mockResolvedValue(undefined);
  mockInstall.mockResolvedValue(undefined);
  mockSettings.mockResolvedValue(undefined);
  mockCanInstall.mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

test('Later suppresses the same release while manual checks can reopen it', async () => {
  const screen = await render(app());
  await waitFor(() => expect(screen.getByText('Update available')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Later' }));
  mockPath = '/partners';
  await screen.rerender(app());
  expect(screen.queryByText('Update available')).toBeNull();
  expect(mockCheck).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Manual check' }));
  await waitFor(() => expect(screen.getByText('Update available')).toBeTruthy());
  expect(mockCheck).toHaveBeenCalledTimes(2);
});

test('download reports actual progress and cancellation fences a late completion', async () => {
  let complete!: () => void;
  mockDownload.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const screen = await render(app());
  await waitFor(() => expect(screen.getByText('Update available')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Download' }));
  await act(() => {
    mockProgress?.({ bytes: 50, total: 100 });
  });
  expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(50);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel download' }));
  await act(async () => {
    complete();
    await Promise.resolve();
  });
  expect(mockCancel).toHaveBeenCalled();
  expect(mockInstall).not.toHaveBeenCalled();
  expect(screen.getByText('Update available')).toBeTruthy();
});

test('navigation into a room stops transfer and never launches the installer', async () => {
  let complete!: () => void;
  mockDownload.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const screen = await render(app());
  await waitFor(() => expect(screen.getByText('Update available')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Download' }));
  mockPath = '/rooms/room-1/session';
  await screen.rerender(app());
  await act(async () => {
    complete();
    await Promise.resolve();
  });
  expect(mockCancel).toHaveBeenCalled();
  expect(mockInstall).not.toHaveBeenCalled();
  expect(screen.queryByText('Downloading update')).toBeNull();
});

test('permission settings require a tap and only a granted return continues installation', async () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    listener = callback;
    return { remove: jest.fn() };
  });
  mockCanInstall.mockReturnValue(false);
  const screen = await render(app());
  await waitFor(() => expect(screen.getByText('Update available')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(screen.getByText('Allow update installation')).toBeTruthy());
  expect(mockSettings).not.toHaveBeenCalled();
  expect(mockInstall).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  await act(() => {
    listener?.('active');
  });
  expect(mockInstall).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  mockCanInstall.mockReturnValue(true);
  await act(() => {
    listener?.('active');
  });
  await waitFor(() => expect(mockInstall).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Update downloaded')).toBeTruthy();
});

test('background download completion waits for explicit installation after returning', async () => {
  let complete!: () => void;
  mockDownload.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const screen = await render(app());
  await waitFor(() => expect(screen.getByText('Update available')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Download' }));
  mockForeground = false;
  await act(async () => {
    complete();
    await Promise.resolve();
  });
  expect(mockInstall).not.toHaveBeenCalled();
  mockForeground = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Install update' }));
  expect(mockInstall).toHaveBeenCalledTimes(1);
});

test('manual check distinguishes current version and recoverable check failure', async () => {
  mockCheck.mockResolvedValue({
    installedVersion: '0.0.81',
    installedVersionCode: 1081,
    release: null,
  });
  const screen = await render(app());
  await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByRole('button', { name: 'Manual check' }));
  await waitFor(() => expect(screen.getByText('You’re up to date')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  mockCheck.mockRejectedValue(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Manual check' }));
  await waitFor(() => expect(screen.getByText('Update incomplete')).toBeTruthy());
});

test('unsupported platforms perform no update request', async () => {
  mockService.supported = false;
  await render(app());
  expect(mockCheck).not.toHaveBeenCalled();
});
