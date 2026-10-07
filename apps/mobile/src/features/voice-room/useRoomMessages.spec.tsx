import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { VoiceRoomApi, RoomTextMessage } from './api';
import { mergeMessages, useRoomMessages } from './useRoomMessages';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'a1434794-a743-4eaf-bc27-6bfd8d377cdd'),
}));
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const message = (id: string, sequence: string, text = id): RoomTextMessage => ({
  id,
  sequence,
  text,
  senderUserId: 'user',
  senderDisplayName: 'Member',
  createdAt: '2026-10-07T00:00:00Z',
});
function Harness({ api, roomId = 'room-1' }: { api: VoiceRoomApi; roomId?: string }) {
  const chat = useRoomMessages(api, roomId);
  return (
    <View>
      <TextInput accessibilityLabel="Message" value={chat.text} onChangeText={chat.setText} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Send"
        onPress={() => void chat.send()}
      >
        <Text>Send</Text>
      </TouchableOpacity>
      {chat.error && <Text>Failed</Text>}
      {chat.messages.map((item) => (
        <Text key={item.id}>{item.text}</Text>
      ))}
    </View>
  );
}
test('orders bigint sequences exactly and merges repeated delivery in a bounded window', () => {
  const first = message('first', '9007199254740993');
  expect(
    mergeMessages([message('second', '9007199254740994')], [first, first]).map((item) => item.id),
  ).toEqual(['first', 'second']);
  expect(
    mergeMessages(
      [],
      Array.from({ length: 400 }, (_, i) => message(String(i), String(i + 1))),
    ),
  ).toHaveLength(300);
});
test('retries a lost send response with the same request ID and merges the polled copy once', async () => {
  const delivered = message('delivered', '1', 'Hello');
  const api = {
    messages: jest.fn<ReturnType<VoiceRoomApi['messages']>, Parameters<VoiceRoomApi['messages']>>(
      async () => ({ items: [delivered], nextCursor: 'cursor', hasMore: false }),
    ),
    sendMessage: jest
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValue(delivered),
  };
  const page = await render(<Harness api={api as never} />);
  await waitFor(() => expect(page.getByText('Hello')).toBeTruthy());
  await fireEvent.changeText(page.getByLabelText('Message'), 'Hello');
  await fireEvent.press(page.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(page.getByText('Failed')).toBeTruthy());
  await fireEvent.press(page.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(page.queryByText('Failed')).toBeNull());
  expect(api.sendMessage.mock.calls[0]).toEqual(api.sendMessage.mock.calls[1]);
  expect(page.getAllByText('Hello')).toHaveLength(1);
  expect(page.getByLabelText('Message').props.value).toBe('');
});
test('background and unmount abort polling; foreground resumes at the last cursor', async () => {
  jest.useFakeTimers();
  let stateListener: ((state: 'active' | 'background') => void) | undefined;
  const remove = jest.fn();
  const state = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    stateListener = listener;
    return { remove };
  });
  const api = {
    messages: jest.fn<ReturnType<VoiceRoomApi['messages']>, Parameters<VoiceRoomApi['messages']>>(
      async () => ({ items: [], nextCursor: 'last', hasMore: false }),
    ),
    sendMessage: jest.fn(),
  };
  const page = await render(<Harness api={api as never} />);
  await act(async () => undefined);
  const initialSignal = api.messages.mock.calls[0]?.[2] as AbortSignal | undefined;
  await act(async () => {
    stateListener?.('background');
    jest.advanceTimersByTime(10000);
  });
  expect(initialSignal?.aborted).toBe(true);
  expect(api.messages).toHaveBeenCalledTimes(1);
  await act(async () => {
    stateListener?.('active');
  });
  expect(api.messages).toHaveBeenLastCalledWith('room-1', 'last', expect.any(AbortSignal));
  await page.unmount();
  await act(async () => {
    jest.advanceTimersByTime(10000);
  });
  expect(api.messages).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalled();
  state.mockRestore();
  jest.useRealTimers();
});
test('a pending send cannot leak into the next room', async () => {
  let resolve: ((message: RoomTextMessage) => void) | undefined;
  const api = {
    messages: jest.fn<ReturnType<VoiceRoomApi['messages']>, Parameters<VoiceRoomApi['messages']>>(
      async () => ({ items: [], nextCursor: 'cursor', hasMore: false }),
    ),
    sendMessage: jest.fn(
      () =>
        new Promise<RoomTextMessage>((done) => {
          resolve = done;
        }),
    ),
  };
  const page = await render(<Harness api={api as never} />);
  await fireEvent.changeText(page.getByLabelText('Message'), 'Old room');
  await fireEvent.press(page.getByRole('button', { name: 'Send' }));
  await page.rerender(<Harness api={api as never} roomId="room-2" />);
  await act(async () => {
    resolve?.(message('old', '1', 'Old room'));
  });
  expect(page.queryByText('Old room')).toBeNull();
  expect(page.getByLabelText('Message').props.value).toBe('');
});
