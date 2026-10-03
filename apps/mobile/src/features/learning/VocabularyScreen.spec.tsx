import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth';
import { RoomApiError } from '../room-discovery/api';
import { PostRoomLearningApi } from './api';
import { VocabularyScreen } from './VocabularyScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), PostRoomLearningApi: jest.fn() }));

const item = { id: 'item-1', kind: 'KEYWORD', text: 'itinerary', note: 'Original', favorite: false, version: 1, createdAt: '', updatedAt: '' };
beforeEach(() => { jest.clearAllMocks(); (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() }); });

test('preserves an edited draft on server version conflict', async () => {
  const list = jest.fn(async () => ({ items: [item], nextCursor: null }));
  const update = jest.fn(async () => { throw new RoomApiError(409, 'VOCABULARY_VERSION_CONFLICT'); });
  (PostRoomLearningApi as jest.Mock).mockImplementation(() => ({ list, update }));
  const page = await render(<VocabularyScreen />);
  await waitFor(() => expect(page.getByText('itinerary')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Edit' }));
  await fireEvent.changeText(page.getByLabelText('Vocabulary text'), 'new itinerary');
  await fireEvent.press(page.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(page.getByText('This item changed on another device. Your input remains here.')).toBeTruthy());
  expect(page.getByLabelText('Vocabulary text').props.value).toBe('new itinerary');
  expect(update).toHaveBeenCalledWith('item-1', 1, { text: 'new itinerary', note: 'Original' });
});

test('resets server cursor when switching filters', async () => {
  const list = jest.fn(async () => ({ items: [item], nextCursor: null }));
  (PostRoomLearningApi as jest.Mock).mockImplementation(() => ({ list }));
  const page = await render(<VocabularyScreen />);
  await waitFor(() => expect(page.getByText('itinerary')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Favorites' }));
  await waitFor(() => expect(list).toHaveBeenLastCalledWith({ favorite: true }));
});
