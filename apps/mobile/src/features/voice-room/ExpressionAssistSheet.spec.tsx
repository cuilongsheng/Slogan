import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { usePrivateRecorder } from '../../services/usePrivateRecorder';
import { ExpressionAssistSheet } from './ExpressionAssistSheet';
jest.mock('../../services/usePrivateRecorder', () => ({ usePrivateRecorder: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'f3101d4b-3806-4658-89a3-c10278ef1f23'),
}));
const recorder = {
  start: jest.fn(async () => undefined),
  stop: jest.fn(async () => ({ uri: 'clip' })),
  discard: jest.fn(),
  elapsedSeconds: 0,
};
beforeEach(() => {
  jest.clearAllMocks();
  (usePrivateRecorder as jest.Mock).mockReturnValue(recorder);
});
const accepted = {
  purpose: 'AI_EXPRESSION_AUDIO',
  status: 'ACCEPTED',
  currentNoticeVersion: 'current-v2',
};
test('press and release auto submit the stopped clip after microphone restoration', async () => {
  const api = {
    consent: jest.fn(async () => accepted),
    audio: jest.fn(async () => ({ primary: { text: 'My English' } })),
  };
  const restore = jest.fn(async () => undefined);
  const page = await render(
    <ExpressionAssistSheet
      roomId="room-1"
      api={api as never}
      muteRoomMicrophone={jest.fn(async () => true)}
      restoreRoomMicrophone={restore}
      onClose={jest.fn()}
    />,
  );
  await waitFor(() => expect(page.getByRole('button', { name: 'Hold to speak' })).toBeTruthy());
  await fireEvent(page.getByRole('button', { name: 'Hold to speak' }), 'pressIn');
  await waitFor(() => expect(recorder.start).toHaveBeenCalled());
  await fireEvent(page.getByRole('button', { name: 'Hold to speak' }), 'pressOut');
  await waitFor(() => expect(page.getByText('My English')).toBeTruthy());
  expect(api.audio).toHaveBeenCalledWith(
    'room-1',
    { uri: 'clip' },
    'current-v2',
    expect.any(String),
    expect.any(AbortSignal),
  );
  expect(restore.mock.invocationCallOrder[0]).toBeLessThan(api.audio.mock.invocationCallOrder[0]!);
});
test('uses current notice consent and exposes withdrawal through processing settings', async () => {
  const api = {
    consent: jest.fn(async () => ({
      ...accepted,
      status: 'REQUIRED',
      currentNoticeVersion: 'new-v3',
    })),
    acceptConsent: jest.fn(async () => ({ ...accepted, currentNoticeVersion: 'new-v3' })),
    revokeConsent: jest.fn(async () => ({
      ...accepted,
      status: 'REVOKED',
      currentNoticeVersion: 'new-v3',
    })),
  };
  const page = await render(
    <ExpressionAssistSheet
      roomId="room-1"
      api={api as never}
      muteRoomMicrophone={jest.fn(async () => true)}
      restoreRoomMicrophone={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await waitFor(() =>
    expect(page.getByRole('button', { name: 'Accept and continue' })).toBeTruthy(),
  );
  await fireEvent.press(page.getByRole('button', { name: 'Accept and continue' }));
  expect(api.acceptConsent).toHaveBeenCalledWith('new-v3', expect.any(String));
  await fireEvent.press(page.getByRole('button', { name: 'Audio processing consent' }));
  await fireEvent.press(page.getByRole('button', { name: 'Revoke audio processing consent' }));
  await waitFor(() => expect(api.revokeConsent).toHaveBeenCalledWith('new-v3', expect.any(String)));
});

test('closing after release but before the notice check completes prevents audio upload', async () => {
  let finishConsent!: (value: typeof accepted) => void;
  const api = {
    consent: jest
      .fn()
      .mockResolvedValueOnce(accepted)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishConsent = resolve;
          }),
      ),
    audio: jest.fn(),
  };
  const onClose = jest.fn();
  const page = await render(
    <ExpressionAssistSheet
      roomId="room-1"
      api={api as never}
      muteRoomMicrophone={jest.fn(async () => true)}
      restoreRoomMicrophone={jest.fn(async () => undefined)}
      onClose={onClose}
    />,
  );
  await waitFor(() => expect(page.getByRole('button', { name: 'Hold to speak' })).toBeTruthy());
  await fireEvent(page.getByRole('button', { name: 'Hold to speak' }), 'pressIn');
  await waitFor(() => expect(recorder.start).toHaveBeenCalled());
  await fireEvent(page.getByRole('button', { name: 'Hold to speak' }), 'pressOut');
  await waitFor(() => expect(api.consent).toHaveBeenCalledTimes(2));
  await fireEvent.press(page.getByRole('button', { name: 'Close' }));
  finishConsent(accepted);
  await waitFor(() => expect(page.getByRole('button', { name: 'Hold to speak' })).toBeTruthy());
  expect(onClose).toHaveBeenCalled();
  expect(api.audio).not.toHaveBeenCalled();
});
