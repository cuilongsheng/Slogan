import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth';
import { SocialApi } from './api';
import { SocialScreen } from './SocialScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useFocusEffect: (callback: () => void | (() => void)) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), SocialApi: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'a9107dd2-549e-4c1e-b17a-99a422902dae') }));

beforeEach(() => { jest.clearAllMocks(); (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() }); });

test('retries a friend request with the same idempotency key after a network failure', async () => {
  const requestFriend = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 'PENDING' });
  (SocialApi as jest.Mock).mockImplementation(() => ({
    friends: jest.fn(async () => ({ items: [], nextCursor: null })),
    available: jest.fn(async () => ({ items: [{ userId: 'user-2', displayName: 'Alex', cefrLevel: 'A2', isAvailable: true }], nextCursor: null })),
    heartbeat: jest.fn(async () => ({ refreshAfterSeconds: 300 })), requestFriend,
  }));
  const page = await render(<SocialScreen />);
  await fireEvent.press(page.getByRole('button', { name: 'Available' }));
  await waitFor(() => expect(page.getByText('Alex')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Add friend' }));
  await waitFor(() => expect(page.getByText('The result is uncertain. Retry the same action.')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Add friend' }));
  await waitFor(() => expect(requestFriend).toHaveBeenCalledTimes(2));
  expect(requestFriend.mock.calls[1]).toEqual(requestFriend.mock.calls[0]);
});
