import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
  const [messages, setMessages] = useState<RoomTextMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [owner, setOwner] = useState({ api, roomId });
  if (owner.api !== api || owner.roomId !== roomId) {
    setOwner({ api, roomId });
    setMessages([]);
    setText('');
    setError(false);
    setSending(false);
  }
  const live = useRef(false);
  const roomGeneration = useRef(0);
  const pending = useRef(false);
  const draft = useRef<{ text: string; id: string } | null>(null);
  useEffect(() => {
    live.current = true;
    const scopeGeneration = ++roomGeneration.current;
    pending.current = false;
    draft.current = null;
    let cursor: string | undefined;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: AbortController | undefined;
    async function poll() {
      if (!active || !live.current) return;
      const current = generation;
      abort = new AbortController();
      try {
        const page = await api.messages(roomId, cursor, abort.signal);
        if (generation !== current || !active || !live.current) return;
        setMessages((items) => mergeMessages(items, page.items));
        cursor = page.nextCursor;
        timer = setTimeout(() => void poll(), page.hasMore ? 0 : 2000);
      } catch {
        if (generation === current && active && live.current)
          timer = setTimeout(() => void poll(), 4000);
      }
    }
    void poll();
    const subscription = AppState.addEventListener('change', (next) => {
      active = next === 'active';
      generation++;
      if (timer) clearTimeout(timer);
      abort?.abort();
      if (active) void poll();
    });
    return () => {
      roomGeneration.current = scopeGeneration + 1;
      live.current = false;
      active = false;
      generation++;
      if (timer) clearTimeout(timer);
      abort?.abort();
      subscription.remove();
    };
  }, [api, roomId]);
  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || [...content].length > 1000 || pending.current) return;
    if (draft.current?.text !== content) draft.current = { text: content, id: randomUUID() };
    const generation = roomGeneration.current;
    pending.current = true;
    setSending(true);
    setError(false);
    try {
      const message = await api.sendMessage(roomId, content, draft.current.id);
      if (!live.current || generation !== roomGeneration.current) return;
      setMessages((items) => mergeMessages(items, [message]));
      setText((value) => (value.trim() === content ? '' : value));
      draft.current = null;
    } catch {
      if (live.current && generation === roomGeneration.current) setError(true);
    } finally {
      if (generation === roomGeneration.current) {
        pending.current = false;
        if (live.current) setSending(false);
      }
    }
  }, [api, roomId, text]);
  return { messages, text, setText, error, sending, send, tooLong: [...text.trim()].length > 1000 };
}
