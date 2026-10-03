import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { usePrivateRecorder } from '../../services/usePrivateRecorder';
import { ExpressionAssistSheet } from './ExpressionAssistSheet';

jest.mock('../../services/usePrivateRecorder', () => ({ usePrivateRecorder: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'f3101d4b-3806-4658-89a3-c10278ef1f23') }));

const recorder = { start: jest.fn(), stop: jest.fn(), discard: jest.fn(), clip: null, recording: false, error: null, elapsedSeconds: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  (usePrivateRecorder as jest.Mock).mockReturnValue(recorder);
});

test('does not start private recording until room microphone is muted', async () => {
  const api = { consent: jest.fn(async () => ({ purpose: 'AI_EXPRESSION_AUDIO', status: 'ACCEPTED', currentNoticeVersion: 'current-v2' })) };
  const muteRoomMicrophone = jest.fn(async () => false);
  const page = await render(<ExpressionAssistSheet roomId="room-1" api={api as never} initialMode="audio" muteRoomMicrophone={muteRoomMicrophone} onClose={jest.fn()} />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Start speaking' })).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Start speaking' }));
  await waitFor(() => expect(page.getByText('Turn off the room microphone before recording privately.')).toBeTruthy());
  expect(recorder.start).not.toHaveBeenCalled();
});

test('uses the current server notice version before starting audio', async () => {
  const api = {
    consent: jest.fn(async () => ({ purpose: 'AI_EXPRESSION_AUDIO', status: 'REQUIRED', currentNoticeVersion: 'new-v3' })),
    acceptConsent: jest.fn(async () => ({ purpose: 'AI_EXPRESSION_AUDIO', status: 'ACCEPTED', currentNoticeVersion: 'new-v3' })),
  };
  const page = await render(<ExpressionAssistSheet roomId="room-1" api={api as never} initialMode="audio" muteRoomMicrophone={jest.fn(async () => true)} onClose={jest.fn()} />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Accept and continue' })).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Accept and continue' }));
  await waitFor(() => expect(api.acceptConsent).toHaveBeenCalledWith('new-v3', expect.any(String)));
  expect(page.getByRole('button', { name: 'Start speaking' })).toBeTruthy();
});

test('retries the same text and request id after a transient failure', async () => {
  const text = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ primary: { text: 'I missed the train.', tone: 'NEUTRAL' }, alternatives: [], noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE' });
  const api = { consent: jest.fn(async () => ({ purpose: 'AI_EXPRESSION_AUDIO', status: 'REQUIRED', currentNoticeVersion: 'new-v3' })), text };
  const page = await render(<ExpressionAssistSheet roomId="room-1" api={api as never} initialMode="text" muteRoomMicrophone={jest.fn()} onClose={jest.fn()} />);
  await fireEvent.changeText(page.getByLabelText('Type what you want to say'), '我误了火车');
  await fireEvent.press(page.getByRole('button', { name: 'Generate English' }));
  await waitFor(() => expect(page.getByText('Could not generate an expression. Try again.')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Generate English' }));
  await waitFor(() => expect(page.getByText('I missed the train.')).toBeTruthy());
  expect(text).toHaveBeenCalledTimes(2);
  expect(text.mock.calls[1]).toEqual(text.mock.calls[0]);
  await fireEvent.press(page.getByRole('button', { name: 'Say another phrase' }));
  expect(page.getByLabelText('Type what you want to say')).toBeTruthy();
  expect(page.queryByRole('button', { name: 'Start speaking' })).toBeNull();
});

test('revokes accepted audio consent from the private sheet', async () => {
  const api = {
    consent: jest.fn(async () => ({ purpose: 'AI_EXPRESSION_AUDIO', status: 'ACCEPTED', currentNoticeVersion: 'current-v2' })),
    revokeConsent: jest.fn(async () => ({ purpose: 'AI_EXPRESSION_AUDIO', status: 'REVOKED', currentNoticeVersion: 'current-v2' })),
  };
  const page = await render(<ExpressionAssistSheet roomId="room-1" api={api as never} initialMode="audio" muteRoomMicrophone={jest.fn()} onClose={jest.fn()} />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Revoke audio processing consent' })).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Revoke audio processing consent' }));
  await waitFor(() => expect(api.revokeConsent).toHaveBeenCalledWith('current-v2', expect.any(String)));
  expect(page.getByRole('button', { name: 'Accept and continue' })).toBeTruthy();
});
