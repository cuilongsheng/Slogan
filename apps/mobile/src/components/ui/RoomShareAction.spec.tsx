import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomShareAction } from './RoomShareAction';
import { shareRoomUrl } from '../../services/shareRoom';

jest.mock('../../services/shareRoom', () => ({ shareRoomUrl: jest.fn() }));

it('shows a copy failure while leaving the server URL selectable for manual use', async () => {
  (shareRoomUrl as jest.Mock).mockRejectedValue(new Error('clipboard denied'));
  const url = 'https://app.example.com/r/opaque-share-code';
  const page = await render(<RoomShareAction url={url} />);
  await fireEvent.press(page.getByRole('button', { name: 'Share room link' }));
  await waitFor(() =>
    expect(page.getByText('Could not copy the link. Please try again.')).toBeTruthy(),
  );
  expect(page.getByText(url)).toBeTruthy();
  expect(shareRoomUrl).toHaveBeenCalledWith(url);
});
