import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth';
import { PostRoomLearningApi } from './api';
import { SummaryScreen } from './SummaryScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), PostRoomLearningApi: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'a9107dd2-549e-4c1e-b17a-99a422902dae') }));

beforeEach(() => { jest.clearAllMocks(); (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() }); });

test('shows pending without import controls', async () => {
  (PostRoomLearningApi as jest.Mock).mockImplementation(() => ({ summary: jest.fn(async () => ({ roomId: 'room-1', topic: 'Travel', status: 'PENDING', items: [] })) }));
  const page = await render(<SummaryScreen roomId="room-1" />);
  await waitFor(() => expect(page.getByText('Summary is still being prepared. Refresh later.')).toBeTruthy());
  expect(page.queryByRole('button', { name: 'Add to my vocabulary' })).toBeNull();
});

test('retries one import with the same request id after a network failure', async () => {
  const importItem = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ id: 'private-1' });
  (PostRoomLearningApi as jest.Mock).mockImplementation(() => ({ summary: jest.fn(async () => ({ roomId: 'room-1', topic: 'Travel', status: 'READY', items: [{ id: 'summary-1', kind: 'KEYWORD', text: 'itinerary', rank: 1 }] })), importItem }));
  const page = await render(<SummaryScreen roomId="room-1" />);
  await waitFor(() => expect(page.getByText('itinerary')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Add to my vocabulary' }));
  await waitFor(() => expect(page.getByText('Import result is uncertain. You can retry.')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Add to my vocabulary' }));
  await waitFor(() => expect(page.getByText('Added')).toBeTruthy());
  expect(importItem.mock.calls).toEqual([['summary-1', 'a9107dd2-549e-4c1e-b17a-99a422902dae'], ['summary-1', 'a9107dd2-549e-4c1e-b17a-99a422902dae']]);
});
