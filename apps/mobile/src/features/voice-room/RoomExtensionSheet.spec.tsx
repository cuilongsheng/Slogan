import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomExtensionSheet } from './RoomExtensionSheet';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'a8f456f2-68c7-4ed0-9116-91182f281433') }));

it('retries an unconfirmed extension with the same request ID and shows the committed result', async () => {
  const extend = jest.fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ endsAt: '2026-09-28T10:00:00Z', providerStatus: 'PENDING' });
  const onUpdated = jest.fn();
  const onRefresh = jest.fn(async () => undefined);
  const onClose = jest.fn();
  const page = await render(
    <RoomExtensionSheet
      roomId="room-1"
      remainingMinutes={24}
      api={{ extend } as never}
      onUpdated={onUpdated}
      onRefresh={onRefresh}
      onClose={onClose}
    />,
  );
  await fireEvent.press(page.getByRole('button', { name: 'Confirm extension' }));
  await waitFor(() => expect(page.getByText('Extension not confirmed. Check the room status and retry.')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Confirm extension' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(extend).toHaveBeenCalledTimes(2);
  expect(extend.mock.calls[1]).toEqual(extend.mock.calls[0]);
  expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ providerStatus: 'PENDING' }));
  expect(onRefresh).toHaveBeenCalledTimes(2);
});
