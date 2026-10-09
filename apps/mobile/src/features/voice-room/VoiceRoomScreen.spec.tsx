import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { VoiceRoomScreen } from './VoiceRoomScreen';
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
  start: jest.fn(async () => undefined),
  refresh: jest.fn(async () => undefined),
  dispose: jest.fn(async () => undefined),
  leave: jest.fn(async (_successor?: string) => {
    mockSnapshot = { ...mockSnapshot, phase: 'left' };
    mockListener(mockSnapshot);
  }),
};
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../auth', () => ({ useAuth: () => ({ authorized: mockAuthorized }) }));
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

test('a host alone exits directly; a host with an online member must select the successor', async () => {
  mockSnapshot.role = 'HOST';
  const alone = await render(<VoiceRoomScreen roomId="room" />);
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
  await fireEvent.press(host.getByRole('button', { name: 'Leave room' }));
  expect(mockSession.leave).not.toHaveBeenCalled();
  await fireEvent.press(host.getAllByRole('button', { name: 'Alex' }).at(-1)!);
  await fireEvent.press(host.getByRole('button', { name: 'Transfer host and leave' }));
  await waitFor(() => expect(mockSession.leave).toHaveBeenCalledWith('successor'));
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
