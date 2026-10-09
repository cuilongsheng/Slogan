import { fireEvent, render } from '@testing-library/react-native';

import { RoomPasswordDialog } from './RoomPasswordDialog';

test('only a four-digit password can submit; cancel leaves the dialog without joining', async () => {
  const submit = jest.fn();
  const cancel = jest.fn();
  const page = await render(
    <RoomPasswordDialog invalid={false} onSubmit={submit} onCancel={cancel} />,
  );
  expect(
    page.getByRole('button', { name: 'Enter voice room' }).props.accessibilityState.disabled,
  ).toBe(true);
  await fireEvent.changeText(page.getByTestId('room-password'), '12x3');
  expect(page.getByTestId('room-password').props.value).toBe('123');
  await fireEvent.changeText(page.getByTestId('room-password'), '1234');
  await fireEvent.press(page.getByRole('button', { name: 'Enter voice room' }));
  expect(submit).toHaveBeenCalledWith('1234');
  await fireEvent.press(page.getByRole('button', { name: 'Cancel' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
});

test('the same password dialog displays backend rejection', async () => {
  const page = await render(
    <RoomPasswordDialog invalid onSubmit={jest.fn()} onCancel={jest.fn()} />,
  );
  expect(page.getByRole('alert')).toBeTruthy();
  expect(page.queryByText('Device check')).toBeNull();
});
