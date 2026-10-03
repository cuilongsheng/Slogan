import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth';
import { RoomApiError } from '../room-discovery/api';
import { RoomHistoryApi } from './api';
import { NoteScreen } from './NoteScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ ...jest.requireActual('./api'), RoomHistoryApi: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ authorized: jest.fn() });
});

test('keeps a conflicting draft until the user explicitly reloads the latest note', async () => {
  const note = jest.fn()
    .mockResolvedValueOnce({ content: 'Original', version: 1, updatedAt: null })
    .mockResolvedValueOnce({ content: 'Other device', version: 2, updatedAt: null });
  const saveNote = jest.fn(async () => { throw new RoomApiError(409, 'ROOM_NOTE_VERSION_CONFLICT'); });
  (RoomHistoryApi as jest.Mock).mockImplementation(() => ({ note, saveNote }));
  const page = await render(<NoteScreen roomId="room-1" />);
  await waitFor(() => expect(page.getByLabelText('Note content').props.value).toBe('Original'));
  await fireEvent.changeText(page.getByLabelText('Note content'), 'My draft');
  await fireEvent.press(page.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(page.getByText(/This note changed on another device/)).toBeTruthy());
  expect(page.getByLabelText('Note content').props.value).toBe('My draft');
  expect(page.getByRole('button', { name: 'Save note' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(page.getByRole('button', { name: 'Load latest note' }));
  await waitFor(() => expect(page.getByLabelText('Note content').props.value).toBe('Other device'));
});

test('clears an existing note with its current server version', async () => {
  const note = jest.fn(async () => ({ content: 'Remove this', version: 5, updatedAt: null }));
  const saveNote = jest.fn(async () => ({ content: null, version: 6, updatedAt: null }));
  (RoomHistoryApi as jest.Mock).mockImplementation(() => ({ note, saveNote }));
  const page = await render(<NoteScreen roomId="room-1" />);
  await waitFor(() => expect(page.getByRole('button', { name: 'Clear note' })).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Clear note' }));
  await waitFor(() => expect(saveNote).toHaveBeenCalledWith('room-1', '', 5));
  await waitFor(() => expect(page.getByText('Saved')).toBeTruthy());
});
