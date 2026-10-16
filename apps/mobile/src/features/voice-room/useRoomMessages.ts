import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useForegroundLive, useLiveUpdates } from '../live-updates';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
import { isAppForeground } from '../../services/foregroundPolling';
import { randomUUID } from 'expo-crypto';
import type { VoiceRoomApi, RoomTextMessage } from './api';

export function mergeMessages(current: RoomTextMessage[], incoming: RoomTextMessage[]) {
  const byId = new Map([...current, ...incoming].map((item) => [item.id, item]));
  return [...byId.values()]
    .sort((a, b) =>
      BigInt(a.sequence) < BigInt(b.sequence)
        ? -1
        : BigInt(a.sequence) > BigInt(b.sequence)
          ? 1
          : 0,
    )
    .slice(-300);
}
export function useRoomMessages(api: VoiceRoomApi, roomId: string) {
  const { owner: account } = useLiveUpdates();
  const [messages, setMessages] = useState<RoomTextMessage[]>([]),
    [text, setText] = useState(''),
    [error, setError] = useState(false),
    [sending, setSending] = useState(false);
  const cursor = useRef<string | undefined>(undefined),
    generation = useRef(0),
    pending = useRef(false),
    draft = useRef<{ text: string; id: string } | null>(null),
    abort = useRef<AbortController | undefined>(undefined),
    queue = useRef(new LatestRequestQueue());
  const refresh = useCallback(
    (current: () => boolean) => {
      const epoch = generation.current;
      return queue.current.enqueue(async () => {
        const live = () => current() && generation.current === epoch;
        if (!live()) return;
        abort.current = new AbortController();
        try {
          for (;;) {
            const previous = cursor.current;
            const page = await api.messages(roomId, previous, abort.current.signal);
            if (!live()) return;
            setMessages((items) => mergeMessages(items, page.items));
            cursor.current = page.nextCursor;
            setError(false);
            if (!page.hasMore) break;
            if (page.nextCursor === previous) throw new Error('Non-advancing room messages');
          }
        } catch {
          if (live()) setError(true);
        }
      });
    },
    [api, roomId],
  );
  useEffect(() => {
    generation.current++;
    cursor.current = undefined;
    draft.current = null;
    pending.current = false;
    const epoch = generation.current;
    void Promise.resolve().then(() => {
      if (generation.current !== epoch) return;
      setMessages([]);
      setText('');
      setError(false);
      setSending(false);
    });
    const invalidate = () => {
      generation.current++;
      abort.current?.abort();
    };
    const cancel = () => {
      invalidate();
      pending.current = false;
      setSending(false);
    };
    const native = AppState.addEventListener('change', cancel);
    const browser = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
    browser?.addEventListener('visibilitychange', cancel);
    return () => {
      invalidate();
      native.remove();
      browser?.removeEventListener('visibilitychange', cancel);
    };
  }, [api, roomId, account]);
  useForegroundLive(refresh, 'room-text', !!roomId, roomId);
  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || [...content].length > 1000 || pending.current || !isAppForeground()) return;
    if (draft.current?.text !== content) draft.current = { text: content, id: randomUUID() };
    const epoch = generation.current;
    pending.current = true;
    setSending(true);
    setError(false);
    try {
      const message = await api.sendMessage(roomId, content, draft.current.id);
      if (epoch !== generation.current || !isAppForeground()) return;
      setMessages((items) => mergeMessages(items, [message]));
      setText((value) => (value.trim() === content ? '' : value));
      draft.current = null;
    } catch {
      if (epoch === generation.current) setError(true);
    } finally {
      if (epoch === generation.current) {
        pending.current = false;
        setSending(false);
      }
    }
  }, [api, roomId, text]);
  return { messages, text, setText, error, sending, send, tooLong: [...text.trim()].length > 1000 };
}
