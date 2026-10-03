import { fireEvent, render } from '@testing-library/react-native';

import { JoinPasswordScreen, JoinRulesScreen } from './JoinScreens';
import { useJoinDraft } from './join';
import { useRoomDetail } from './useRoomDetail';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('./useRoomDetail', () => ({ useRoomDetail: jest.fn() }));
jest.mock('./join', () => ({ ...jest.requireActual('./join'), useJoinDraft: jest.fn() }));

const room = {
  id: 'room-a',
  topic: 'Travel',
  cefrLevel: 'B1',
  hostDisplayName: 'Luna',
  memberCount: 2,
  capacity: 6,
  endsAt: '2099-01-01T00:00:00.000Z',
  passwordProtected: true,
  hostReconnectDeadline: null,
};

describe('joining preparation pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRoomDetail as jest.Mock).mockReturnValue({ room, loading: false, error: false });
  });

  it('blocks password continuation until exactly four digits have been entered', async () => {
    (useJoinDraft as jest.Mock).mockReturnValue({
      draft: { roomId: 'room-a', password: '123', rulesAccepted: false },
      password: jest.fn(),
    });
    const page = await render(<JoinPasswordScreen roomId="room-a" />);
    expect(page.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled).toBe(
      true,
    );
    await page.unmount();

    (useJoinDraft as jest.Mock).mockReturnValue({
      draft: { roomId: 'room-a', password: '1234', rulesAccepted: false },
      password: jest.fn(),
    });
    const valid = await render(<JoinPasswordScreen roomId="room-a" />);
    await fireEvent.press(valid.getByRole('button', { name: 'Continue' }));
    expect(mockPush).toHaveBeenCalledWith('/rooms/room-a/rules');
  });

  it('requires active rule consent and rejects a draft for another room', async () => {
    (useJoinDraft as jest.Mock).mockReturnValue({
      draft: { roomId: 'room-a', password: '1234', rulesAccepted: false },
      acceptRules: jest.fn(),
    });
    const page = await render(<JoinRulesScreen roomId="room-a" />);
    expect(
      page.getByRole('button', { name: 'Confirm and continue' }).props.accessibilityState.disabled,
    ).toBe(true);
    await page.unmount();

    (useJoinDraft as jest.Mock).mockReturnValue({
      draft: { roomId: 'room-b', password: '1234', rulesAccepted: true },
      acceptRules: jest.fn(),
    });
    const wrongRoom = await render(<JoinRulesScreen roomId="room-a" />);
    expect(wrongRoom.queryByRole('button', { name: 'Confirm and continue' })).toBeNull();
  });
});
