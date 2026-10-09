import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RoomListScreen } from './RoomListScreen';

const mockPush = jest.fn();
const mockBeginDirect = jest.fn();
const mockAuthorized = jest.fn();
const mockList = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../auth', () => ({ useAuth: () => ({ authorized: mockAuthorized }) }));
jest.mock('./join', () => ({ useJoinDraft: () => ({ beginDirect: mockBeginDirect }) }));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  RoomDiscoveryApi: jest.fn(() => ({ list: mockList })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue({
    items: [
      {
        id: 'room-a',
        topic: 'Travel',
        cefrLevel: 'B1',
        memberCount: 1,
        capacity: 4,
        hostDisplayName: 'Luna',
        passwordProtected: false,
        endsAt: '2099-01-01T00:00:00Z',
        hostReconnectDeadline: null,
      },
    ],
    nextCursor: null,
  });
});

test('one card press goes straight to the session and a second press cannot navigate again', async () => {
  const page = await render(<RoomListScreen />);
  await waitFor(() => expect(page.getByText('Travel')).toBeTruthy());
  await fireEvent.press(page.getByText('Travel'));
  await fireEvent.press(page.getByText('Travel'));
  expect(mockBeginDirect).toHaveBeenCalledTimes(1);
  expect(mockBeginDirect).toHaveBeenCalledWith('room-a');
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/rooms/room-a/session');
});

test('a protected room goes only to the password input', async () => {
  const room = (await mockList()).items[0];
  mockList.mockResolvedValue({ items: [{ ...room, passwordProtected: true }], nextCursor: null });
  const page = await render(<RoomListScreen />);
  await waitFor(() => expect(page.getByText('Travel')).toBeTruthy());
  await fireEvent.press(page.getByText('Travel'));
  expect(mockPush).toHaveBeenCalledWith('/rooms/room-a/session');
});
