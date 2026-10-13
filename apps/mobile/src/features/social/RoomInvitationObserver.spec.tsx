import type * as ReactTypes from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { RoomInvitationObserver } from './RoomInvitationObserver';

const mockPush = jest.fn(),
  mockBegin = jest.fn(),
  mockDecline = jest.fn(),
  mockInvitations = jest.fn();
const mockRouter = { push: mockPush };
let mockPath = '/partners';
let mockUser: string | null = 'account-a';
const mockAuthorized = jest.fn();
jest.mock('expo-router', () => ({ usePathname: () => mockPath, useRouter: () => mockRouter }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'retry-id' }));
jest.mock('../auth', () => ({
  useAuth: () => ({
    authorized: mockAuthorized,
    state: mockUser
      ? { kind: 'signedIn', me: { userId: mockUser, onboardingState: 'ELIGIBLE' } }
      : { kind: 'signedOut' },
  }),
}));
jest.mock('../room-discovery', () => ({ useJoinDraft: () => ({ beginDirect: mockBegin }) }));
jest.mock('./api', () => ({
  SocialApi: jest.fn(() => ({ invitations: mockInvitations, declineInvitation: mockDecline })),
}));
jest.mock('../../hooks/useForegroundPolling', () => ({
  useForegroundPolling: (
    work: (current: () => boolean) => Promise<void>,
    _interval: number,
    enabled: boolean,
  ) => {
    const React = jest.requireActual('react') as typeof ReactTypes;
    React.useEffect(() => {
      let alive = true;
      if (enabled) void work(() => alive);
      return () => {
        alive = false;
      };
    }, [work, enabled]);
  },
}));
const invite = (status = 'OPEN') => ({
  id: 'invite-1',
  roomId: 'room-1',
  inviterDisplayName: 'Luna',
  room: { topic: 'Travel', status, passwordProtected: true },
});
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = 'account-a';
  mockPath = '/partners';
  mockInvitations.mockResolvedValue({ items: [invite()], nextCursor: null });
  mockDecline.mockResolvedValue({});
});
test('notifies the receiver, supports later/reopen and passes invitation admission through existing room route', async () => {
  const screen = await render(<RoomInvitationObserver />);
  await waitFor(() => expect(screen.getByText('Travel')).toBeTruthy());
  await fireEvent.press(screen.getAllByRole('button', { name: 'Later' })[0]!);
  await fireEvent.press(screen.getByRole('button', { name: /Room invitations/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Join room' }));
  expect(mockBegin).toHaveBeenCalledWith('room-1', 'invite-1');
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/rooms/[roomId]/session',
    params: { roomId: 'room-1', invitationId: 'invite-1' },
  });
});
test('scheduled invitation opens details and does not try immediate admission', async () => {
  mockInvitations.mockResolvedValue({ items: [invite('SCHEDULED')], nextCursor: null });
  const screen = await render(<RoomInvitationObserver />);
  await waitFor(() => expect(screen.getByText('Travel')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'View room' }));
  expect(mockBegin).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/rooms/[roomId]',
    params: { roomId: 'room-1', invitationId: 'invite-1' },
  });
});
test('decline retries preserve request identity and keep feedback visible until successful', async () => {
  mockDecline.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  const screen = await render(<RoomInvitationObserver />);
  await waitFor(() => expect(screen.getByText('Travel')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Decline' }));
  await waitFor(() => expect(screen.getByRole('alert', { name: /./ })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Decline' }));
  await waitFor(() => expect(mockDecline).toHaveBeenCalledTimes(2));
  expect(mockDecline.mock.calls[1]).toEqual(mockDecline.mock.calls[0]);
  await waitFor(() => expect(screen.queryByTestId('incoming-room-invitation')).toBeNull());
});
test.each(['/calls/call-1', '/rooms/room-1/session', '/me/reports'])(
  'does not steal an active page %s',
  async (path) => {
    mockPath = path;
    const screen = await render(<RoomInvitationObserver />);
    expect(mockInvitations).not.toHaveBeenCalled();
    expect(screen.queryByTestId('incoming-room-invitation')).toBeNull();
  },
);
test('a late previous-account response cannot appear after signing in as another account', async () => {
  let resolve!: (value: unknown) => void;
  mockInvitations
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue({ items: [], nextCursor: null });
  const screen = await render(<RoomInvitationObserver />);
  mockUser = 'account-b';
  await screen.rerender(<RoomInvitationObserver />);
  await act(async () => resolve({ items: [invite()], nextCursor: null }));
  expect(screen.queryByText('Travel')).toBeNull();
  mockUser = null;
  await screen.rerender(<RoomInvitationObserver />);
  expect(screen.queryByTestId('incoming-room-invitation')).toBeNull();
});
