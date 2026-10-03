import { fireEvent, render } from '@testing-library/react-native';

import { RoomDetailScreen } from './RoomDetailScreen';
import { useJoinDraft } from './join';
import { useRoomDetail } from './useRoomDetail';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('./useRoomDetail', () => ({ useRoomDetail: jest.fn() }));
jest.mock('./join', () => ({ useJoinDraft: jest.fn() }));

const base = {
  id: 'room-a',
  topic: 'Travel',
  cefrLevel: 'B1',
  hostDisplayName: 'Luna',
  memberCount: 2,
  capacity: 6,
  endsAt: '2099-01-01T00:00:00.000Z',
  passwordProtected: false,
  hostReconnectDeadline: null,
  sensitiveSpeechDetectionEnabled: true,
};

describe('room detail availability', () => {
  const begin = jest.fn();
  const reload = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useJoinDraft as jest.Mock).mockReturnValue({ begin });
  });

  it.each([
    ['open', false, '/rooms/room-a/rules'],
    ['password', true, '/rooms/room-a/password'],
  ])(
    'routes an available %s room through its appropriate preparation page',
    async (_, passwordProtected, path) => {
      (useRoomDetail as jest.Mock).mockReturnValue({
        room: { ...base, passwordProtected },
        loading: false,
        error: false,
        reload,
      });
      const page = await render(<RoomDetailScreen roomId="room-a" />);
      await fireEvent.press(page.getByRole('button', { name: 'Review joining steps' }));
      expect(begin).toHaveBeenCalledWith('room-a');
      expect(mockPush).toHaveBeenCalledWith(path);
    },
  );

  it('rechecks full or ended rooms and does not begin preparation', async () => {
    (useRoomDetail as jest.Mock).mockReturnValue({
      room: { ...base, memberCount: 6 },
      loading: false,
      error: false,
      reload,
    });
    const page = await render(<RoomDetailScreen roomId="room-a" />);
    await fireEvent.press(page.getByRole('button', { name: 'Reload room' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(begin).not.toHaveBeenCalled();
    await page.unmount();

    (useRoomDetail as jest.Mock).mockReturnValue({
      room: { ...base, endsAt: '2020-01-01T00:00:00.000Z' },
      loading: false,
      error: false,
      reload,
    });
    const ended = await render(<RoomDetailScreen roomId="room-a" />);
    await fireEvent.press(ended.getByRole('button', { name: 'Reload room' }));
    expect(begin).not.toHaveBeenCalled();
  });

  it('shows a retry for failed reads', async () => {
    (useRoomDetail as jest.Mock).mockReturnValue({
      room: null,
      loading: false,
      error: true,
      reload,
    });
    const page = await render(<RoomDetailScreen roomId="room-a" />);
    await fireEvent.press(page.getByText('Reload room'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
