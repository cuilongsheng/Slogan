import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth';
import { RoomHistoryApi } from './api';
import { HistoryScreen } from './HistoryScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), RoomHistoryApi: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() });
});

test('distinguishes participation from reservation and only opens an ended participant note', async () => {
  const list = jest.fn(async () => ({ items: [
    { roomId: 'room-1', topic: 'Speaking practice', kind: 'INSTANT', status: 'ENDED', relationship: 'PARTICIPATED', cefrLevel: 'A2', occurredAt: '2026-09-27T12:00:00.000Z', noteExists: false },
    { roomId: 'room-2', topic: 'Booked room', kind: 'APPOINTMENT', status: 'ENDED', relationship: 'RESERVED_ONLY', cefrLevel: 'B1', occurredAt: '2026-09-27T13:00:00.000Z', noteExists: false },
  ], nextCursor: null }));
  (RoomHistoryApi as jest.Mock).mockImplementation(() => ({ list }));
  const page = await render(<HistoryScreen />);
  await waitFor(() => expect(page.getByText('Reserved only · Scheduled room · B1')).toBeTruthy());
  expect(page.getAllByText(/Write private note/)).toHaveLength(1);
  await fireEvent.press(page.getByRole('button', { name: /Write private note/ }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/me/history/[roomId]', params: { roomId: 'room-1' } });
});
