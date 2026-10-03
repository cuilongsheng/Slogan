import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth';
import { RoomApiError } from '../room-discovery/api';
import { MySafetyApi } from './api';
import { RestrictionsScreen } from './RestrictionsScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), MySafetyApi: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '3e20e9c3-8ca0-49fa-83ce-e7822f157091') }));

const item = {
  id: 'restriction-1',
  severity: 'GENERAL',
  reason: 'Visible reason',
  startsAt: '2026-09-28T08:00:00.000Z',
  endsAt: '2026-09-28T11:00:00.000Z',
  appealDeadlineAt: '2026-09-28T08:30:00.000Z',
  status: 'ACTIVE',
  appealStatus: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-28T08:10:00.000Z').getTime());
  (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());

test('keeps the same appeal request id when retrying unchanged content', async () => {
  const list = jest.fn(async () => ({ items: [item], nextCursor: null }));
  const appeal = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 'PENDING' });
  (MySafetyApi as jest.Mock).mockImplementation(() => ({ list, appeal }));
  const page = await render(<RestrictionsScreen />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Appeal this restriction' })).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Appeal this restriction' }));
  await fireEvent.changeText(page.getByLabelText('Appeal reason'), 'Please review');
  await fireEvent.press(page.getByRole('button', { name: 'Submit appeal' }));
  await waitFor(() => expect(page.getByText('Could not submit the appeal. Try again.')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Submit appeal' }));
  await waitFor(() => expect(appeal).toHaveBeenCalledTimes(2));
  expect(appeal.mock.calls[1]).toEqual(appeal.mock.calls[0]);
});

test('shows an empty state without an appeal command', async () => {
  (MySafetyApi as jest.Mock).mockImplementation(() => ({ list: jest.fn(async () => ({ items: [], nextCursor: null })) }));
  const page = await render(<RestrictionsScreen />);
  await waitFor(() => expect(page.getByText('No restriction history')).toBeTruthy());
  expect(page.queryByRole('button', { name: 'Appeal this restriction' })).toBeNull();
});

test('shows a closed window response and refreshes the server state', async () => {
  const list = jest.fn(async () => ({ items: [item], nextCursor: null }));
  const appeal = jest.fn(async () => { throw new RoomApiError(409, 'SAFETY_APPEAL_CLOSED'); });
  (MySafetyApi as jest.Mock).mockImplementation(() => ({ list, appeal }));
  const page = await render(<RestrictionsScreen />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Appeal this restriction' })).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Appeal this restriction' }));
  await fireEvent.changeText(page.getByLabelText('Appeal reason'), 'Please review');
  await fireEvent.press(page.getByRole('button', { name: 'Submit appeal' }));
  await waitFor(() => expect(page.getByText('The appeal window has closed.')).toBeTruthy());
  expect(list).toHaveBeenCalledTimes(2);
  expect(page.queryByText('Your appeal was submitted and is pending review.')).toBeNull();
});
