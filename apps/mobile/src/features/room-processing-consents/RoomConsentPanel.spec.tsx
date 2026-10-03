import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { randomUUID } from 'expo-crypto';

import { useAuth } from '../auth';
import { RoomProcessingConsentApi } from './api';
import { RoomConsentPanel } from './RoomConsentPanel';

jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), RoomProcessingConsentApi: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (randomUUID as jest.Mock).mockReset().mockReturnValue('a9107dd2-549e-4c1e-b17a-99a422902dae');
  (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() });
});

test('requires independent current consent for both enabled purposes', async () => {
  (randomUUID as jest.Mock)
    .mockReturnValueOnce('a9107dd2-549e-4c1e-b17a-99a422902dae')
    .mockReturnValueOnce('a9107dd2-549e-4c1e-b17a-99a422902daf');
  const list = jest.fn(async () => [
    { purpose: 'ROOM_SAFETY_DETECTION', status: 'REQUIRED', currentNoticeVersion: '2026-09-v1', noticeVersion: null },
    { purpose: 'POST_ROOM_KEYWORDS', status: 'REQUIRED', currentNoticeVersion: '2026-09-v1', noticeVersion: null },
  ]);
  const command = jest.fn(async (purpose) => ({ purpose, status: 'ACCEPTED', currentNoticeVersion: '2026-09-v1', noticeVersion: '2026-09-v1' }));
  (RoomProcessingConsentApi as jest.Mock).mockImplementation(() => ({ list, command }));
  const onReadyChange = jest.fn();
  const page = await render(<RoomConsentPanel safety keywords onReadyChange={onReadyChange} />);
  await waitFor(() => expect(page.getAllByRole('button', { name: 'Read and accept this purpose' })).toHaveLength(2));
  expect(onReadyChange).toHaveBeenLastCalledWith(false);
  await fireEvent.press(page.getAllByRole('button', { name: 'Read and accept this purpose' })[0]!);
  expect(onReadyChange).toHaveBeenLastCalledWith(false);
  await fireEvent.press(page.getByRole('button', { name: 'Read and accept this purpose' }));
  await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true));
  expect(command).toHaveBeenNthCalledWith(1, 'ROOM_SAFETY_DETECTION', 'ACCEPT', '2026-09-v1', 'a9107dd2-549e-4c1e-b17a-99a422902dae');
  expect(command).toHaveBeenNthCalledWith(2, 'POST_ROOM_KEYWORDS', 'ACCEPT', '2026-09-v1', 'a9107dd2-549e-4c1e-b17a-99a422902daf');
});

test('keeps the same request id when an acceptance needs a retry', async () => {
  const list = jest.fn(async () => [{ purpose: 'ROOM_SAFETY_DETECTION', status: 'REQUIRED', currentNoticeVersion: '2026-09-v1', noticeVersion: null }]);
  const command = jest.fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ purpose: 'ROOM_SAFETY_DETECTION', status: 'ACCEPTED', currentNoticeVersion: '2026-09-v1', noticeVersion: '2026-09-v1' });
  (RoomProcessingConsentApi as jest.Mock).mockImplementation(() => ({ list, command }));
  const page = await render(<RoomConsentPanel safety keywords={false} />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Read and accept this purpose' })).toBeTruthy());
  const accept = page.getByRole('button', { name: 'Read and accept this purpose' });
  await act(async () => { fireEvent.press(accept); });
  await waitFor(() => expect(page.getByText('Consent state is uncertain. You can retry the same action.')).toBeTruthy());
  await act(async () => { fireEvent.press(page.getByRole('button', { name: 'Read and accept this purpose' })); });
  await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
  expect(command.mock.calls[0][3]).toBe(command.mock.calls[1][3]);
  expect(randomUUID).toHaveBeenCalledTimes(1);
});

test('fails closed when the server notice version is newer than bundled copy', async () => {
  (RoomProcessingConsentApi as jest.Mock).mockImplementation(() => ({ list: jest.fn(async () => [{ purpose: 'POST_ROOM_KEYWORDS', status: 'REQUIRED', currentNoticeVersion: '2026-10-v2', noticeVersion: null }]) }));
  const page = await render(<RoomConsentPanel safety={false} keywords />);
  await waitFor(() => expect(page.getByText('The notice changed. Update the app to read and accept the new version.')).toBeTruthy());
  expect(page.queryByRole('button', { name: 'Read and accept this purpose' })).toBeNull();
});
