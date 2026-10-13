import type * as ReactTypes from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { VoiceRoomScreen } from './VoiceRoomScreen';
import { copyRoomUrl } from '../../services/shareRoom';
import type { VoiceSessionSnapshot } from './session';

const mockReplace = jest.fn();
const mockAuthorized = jest.fn();
const mockClear = jest.fn();
let mockSnapshot: VoiceSessionSnapshot;
let mockListener: (snapshot: VoiceSessionSnapshot) => void;
const mockMessage = {
  id: 'message-1',
  sequence: '1',
  senderUserId: 'member',
  senderDisplayName: 'Member',
  text: 'Hello room',
  createdAt: '2026-10-07T00:00:00Z',
};
const mockApi = {
  messages: jest.fn(async () => ({ items: [], nextCursor: 'cursor', hasMore: false })),
  sendMessage: jest.fn(async () => mockMessage),
};
const mockAudio = jest.fn();
const mockSession = {
  get snapshot() {
    return mockSnapshot;
  },
  subscribe: (listener: typeof mockListener) => {
    mockListener = listener;
    listener(mockSnapshot);
    return jest.fn();
  },
  recordRoomVisible: jest.fn(),
  start: jest.fn(async () => undefined),
  refresh: jest.fn(async () => undefined),
  dispose: jest.fn(async () => undefined),
  leave: jest.fn(async (_successor?: string) => {
    mockSnapshot = { ...mockSnapshot, phase: 'left' };
    mockListener(mockSnapshot);
  }),
};
jest.mock('../../services/shareRoom', () => ({ copyRoomUrl: jest.fn(async () => {}) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual('react') as typeof ReactTypes;
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('../auth', () => ({
  useAuth: () => ({
    authorized: mockAuthorized,
    state: { kind: 'signedIn', me: { userId: 'member' } },
  }),
}));
jest.mock('../room-discovery/join', () => ({
  ...jest.requireActual('../room-discovery/join'),
  useJoinDraft: () => ({ draft: null, clear: mockClear }),
}));
jest.mock('../../services/usePrivateRecorder', () => ({ usePrivateRecorder: jest.fn() }));
jest.mock('../../api/client', () => ({ createMobileApiClient: () => ({}) }));
jest.mock('./media', () => ({ createVoiceMedia: () => ({}) }));
jest.mock('./api', () => ({ VoiceRoomApi: jest.fn(() => mockApi) }));
jest.mock('./assistanceApi', () => ({
  ExpressionAssistanceApi: jest.fn(() => ({ audio: mockAudio })),
}));
jest.mock('./session', () => ({ VoiceRoomSession: jest.fn(() => mockSession) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'd9b420d4-f721-4599-9360-2926595a3e61' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot = {
    phase: 'active',
    role: 'MEMBER',
    credentialVersion: 2,
    errorCode: null,
    room: {
      id: 'room',
      topic: 'Travel',
      cefrLevel: 'B1',
      cefrLevelMin: 'B1',
      cefrLevelMax: 'B2',
      memberCount: 2,
      capacity: 4,
      endsAt: '2099-01-01T00:00:00Z',
      sensitiveSpeechDetectionEnabled: false,
    } as VoiceSessionSnapshot['room'],
    members: [],
    media: {
      connection: 'connected',
      localIdentity: 'member',
      microphoneEnabled: true,
      audioPlaybackAllowed: true,
      participants: [],
    },
    safetyAlerts: [],
    safetyAlertsCursor: null,
    safetyAlertsLoading: false,
    safetyAlertsDenied: false,
    safetyAlertsError: false,
  };
});

test('confirmed admission shows the room while initial media connection remains pending', async () => {
  mockSnapshot = {
    ...mockSnapshot,
    phase: 'connecting',
    media: { ...mockSnapshot.media, connection: 'connecting', microphoneEnabled: false },
  };
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  expect(screen.getByText('Travel')).toBeTruthy();
  expect(screen.getByText('Connecting')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Turn on microphone' })).toBeDisabled();
  expect(screen.queryByText('Reconnecting')).toBeNull();
  await screen.unmount();
});

test('level and LIVE are single-line nonshrinking labels, without a redundant initial refresh', async () => {
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  expect(screen.getByText('B1 ～ B2').props.numberOfLines).toBe(1);
  expect(screen.getByText('●\u00a0 LIVE').props.numberOfLines).toBe(1);
  expect(mockSession.refresh).not.toHaveBeenCalled();
});

test('pressing another occupied avatar opens that member report directly', async () => {
  mockSnapshot.members = [
    {
      membershipId: 'other-membership',
      userId: 'other-user',
      participantIdentity: 'other',
      displayName: 'Mika',
      avatarUrl: null,
      nationalityCode: 'JP',
      cefrLevel: 'B1',
      credentialVersion: 1,
      hostReconnectDeadline: null,
      position: 1,
      role: 'MEMBER',
      lifecycle: 'ACTIVE',
      presence: 'CONNECTED',
      joinedAt: '2026-10-07T00:00:00Z',
    } as VoiceSessionSnapshot['members'][number],
  ];
  const page = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(page.getByRole('button', { name: 'Mika' }));
  expect(page.getByText('Report a member')).toBeTruthy();
  expect(page.getAllByText('Mika')).toHaveLength(2);
  expect(page.queryByText('Manage members')).toBeNull();
});

test('the room overflow has report, leave and share actions and opens room reporting directly', async () => {
  const page = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(page.getByRole('button', { name: 'Room actions' }));
  expect(page.getByRole('button', { name: 'Report room' })).toBeTruthy();
  expect(page.getByRole('button', { name: 'Share room link' })).toBeTruthy();
  await fireEvent.press(page.getByRole('button', { name: 'Report room' }));
  expect(page.getByText('Choose a reason and describe what happened in this room.')).toBeTruthy();
  expect(page.getAllByText('Travel')).toHaveLength(2);
  await fireEvent.press(page.getAllByRole('button', { name: 'Close' }).at(-1)!);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('the actual composer sends room text and renders the result without calling expression assistance', async () => {
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.changeText(screen.getByLabelText('Say something…'), 'Hello room');
  await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(screen.getByText('Hello room')).toBeTruthy());
  expect(mockApi.sendMessage).toHaveBeenCalledWith(
    'room',
    'Hello room',
    'd9b420d4-f721-4599-9360-2926595a3e61',
  );
  expect(screen.getByLabelText('Say something…').props.value).toBe('');
  expect(mockAudio).not.toHaveBeenCalled();
});

test('ordinary exit returns to discovery directly, with no handoff or rejoin', async () => {
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Leave room' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/rooms'));
  expect(mockSession.leave).toHaveBeenCalledWith();
  expect(mockSession.start).toHaveBeenCalledTimes(1);
});

test('host exit returns immediately and delegates default succession to the server', async () => {
  mockSnapshot.role = 'HOST';
  const alone = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(alone.getByRole('button', { name: 'Room actions' }));
  await fireEvent.press(alone.getByRole('button', { name: 'Leave room' }));
  await waitFor(() => expect(mockSession.leave).toHaveBeenCalledTimes(1));
  await alone.unmount();
  mockSnapshot.phase = 'active';
  mockSnapshot.members = [
    {
      membershipId: 'successor',
      displayName: 'Alex',
      role: 'MEMBER',
      position: 1,
      presence: 'CONNECTED',
      participantIdentity: 'alex',
      cefrLevel: 'B1',
    },
  ] as VoiceSessionSnapshot['members'];
  mockSession.leave.mockClear();
  const host = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(host.getByRole('button', { name: 'Room actions' }));
  await fireEvent.press(host.getByRole('button', { name: 'Leave room' }));
  expect(mockSession.leave).toHaveBeenCalledWith();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/rooms'));
  expect(host.queryByRole('button', { name: 'Transfer host and leave' })).toBeNull();
});

test('password rejection stays in a dialog and retries the same session with invitation preserved', async () => {
  mockSnapshot.phase = 'failed';
  mockSnapshot.credentialVersion = null;
  mockSnapshot.errorCode = 'ROOM_PASSWORD_INVALID';
  const screen = await render(<VoiceRoomScreen roomId="room" invitationId="invite-a" />);
  await fireEvent.changeText(screen.getByTestId('room-password'), '1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Enter voice room' }));
  expect(mockSession.start).toHaveBeenLastCalledWith({
    roomId: 'room',
    password: '1234',
    rulesAccepted: true,
    invitationId: 'invite-a',
  });
  expect(mockReplace).not.toHaveBeenCalled();
});

test('an empty seat opens in-app people selection and sends a room invitation', async () => {
  mockSnapshot = { ...mockSnapshot, role: 'HOST' };
  const availablePeople = jest.fn(async () => ({
    items: [
      { userId: 'idle-user', displayName: 'Idle partner', cefrLevel: 'B1', isAvailable: true },
    ],
    nextCursor: null,
  }));
  const inviteUser = jest.fn(async () => ({ id: 'invitation' }));
  Object.assign(mockApi, { availablePeople, inviteUser });
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(screen.getByTestId('room-empty-seat-0'));
  await waitFor(() => expect(screen.getByText('Idle partner')).toBeTruthy());
  expect(screen.queryByText('Share link')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Invite Idle partner' }));
  await waitFor(() =>
    expect(inviteUser).toHaveBeenCalledWith('room', 'idle-user', expect.any(String)),
  );
});

test.each(['Back', 'Leave room'])(
  'automatic reconnect exposes %s as a real session exit',
  async (control) => {
    mockSnapshot.media.connection = 'reconnecting';
    const screen = await render(<VoiceRoomScreen roomId="room" />);
    expect(screen.getByText('Reconnecting')).toBeTruthy();
    expect(screen.getByLabelText('Say something…')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: control }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/rooms'));
    expect(mockSession.leave).toHaveBeenCalledTimes(1);
  },
);

test('transient recovery keeps the composer mounted and preserves an unsent message', async () => {
  mockSnapshot.media.connection = 'reconnecting';
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.changeText(screen.getByLabelText('Say something…'), 'Keep this draft');
  expect(screen.queryByTestId('reconnecting-panel')).toBeNull();
  expect(screen.getByRole('button', { name: 'Mute microphone' })).toBeDisabled();
  await act(async () => {
    mockSnapshot = { ...mockSnapshot, media: { ...mockSnapshot.media, connection: 'connected' } };
    mockListener(mockSnapshot);
  });
  expect(screen.getByLabelText('Say something…').props.value).toBe('Keep this draft');
  expect(mockSession.start).toHaveBeenCalledTimes(1);
});

test('sharing copies the admitted link directly and reports success without opening another sheet', async () => {
  mockSnapshot.room!.shareUrl = 'https://app.example/r/opaque';
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Room actions' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Share room link' }));
  expect(copyRoomUrl).toHaveBeenCalledWith('https://app.example/r/opaque');
  await waitFor(() => expect(screen.getByText('Link copied')).toBeTruthy());
  expect(screen.queryByText('https://app.example/r/opaque')).toBeNull();
  expect(mockSession.leave).not.toHaveBeenCalled();
});
test('ordinary members receive an invitation explanation instead of an inert control', async () => {
  const screen = await render(<VoiceRoomScreen roomId="room" />);
  await fireEvent.press(screen.getByTestId('room-empty-seat-0'));
  expect(
    screen.getByText('Only the host can invite partners. You can copy the room link to share it.'),
  ).toBeTruthy();
});
