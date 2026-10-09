import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { RoomDeviceNotice } from './RoomDeviceNotice';
import type { MediaSnapshot } from './mediaCore';

const media: MediaSnapshot = {
  connection: 'connected',
  localIdentity: 'self',
  microphoneEnabled: false,
  audioPlaybackAllowed: true,
  participants: [],
};
test('reports microphone denial in the room and offers retry without a preparation screen', async () => {
  const retry = jest.fn(async () => {});
  const screen = await render(
    <RoomDeviceNotice
      media={{ ...media, deviceCheck: { microphone: 'denied', playback: 'ready' } }}
      errorCode={null}
      onRetry={retry}
      onEnableAudio={async () => {}}
    />,
  );
  expect(
    screen.getByText('Microphone permission was denied. You can still listen and send text.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Check devices again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
test('permanent denial offers system settings and audio blockage offers enable sound', async () => {
  const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const enableAudio = jest.fn(async () => {});
  const screen = await render(
    <RoomDeviceNotice
      media={{
        ...media,
        audioPlaybackAllowed: false,
        deviceCheck: { microphone: 'blocked', playback: 'unavailable' },
      }}
      errorCode={null}
      onRetry={async () => {}}
      onEnableAudio={enableAudio}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Open system settings' }));
  expect(settings).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText('Audio playback unavailable. Check your headphones or speaker and retry.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Tap to enable room audio' }));
  expect(enableAudio).toHaveBeenCalledTimes(1);
  settings.mockRestore();
});
