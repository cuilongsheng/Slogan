import { render } from '@testing-library/react-native';

import type { RoomSummary } from './api';
import { RoomCard } from './RoomCard';

const room = {
  id: 'room-a', topic: 'Travel', cefrLevel: 'B1', hostDisplayName: 'Luna',
  memberCount: 2, capacity: 6, endsAt: '2099-01-01T00:00:00.000Z',
  passwordProtected: false, hostReconnectDeadline: null,
  sensitiveSpeechDetectionEnabled: false, postRoomKeywordsEnabled: false,
} as RoomSummary;

test('shows both processing choices before opening a room', async () => {
  const page = await render(<RoomCard room={room} index={0} onPress={jest.fn()} />);
  expect(page.getByText('Speech safety detection off')).toBeTruthy();
  expect(page.getByText('Post-room keywords: off')).toBeTruthy();
  await page.rerender(<RoomCard room={{ ...room, sensitiveSpeechDetectionEnabled: true, postRoomKeywordsEnabled: true }} index={0} onPress={jest.fn()} />);
  expect(page.getByText('Speech safety detection on')).toBeTruthy();
  expect(page.getByText('Post-room keywords: on')).toBeTruthy();
});
