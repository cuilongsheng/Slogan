import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../auth';
import { RoomDiscoveryApi, type RoomDetail } from './api';

export function useRoomDetail(roomId: string) {
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomDiscoveryApi(authorized), [authorized]);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setRoom(null);
    setLoading(true);
    setError(false);
    try {
      const next = await api.detail(roomId);
      if (current === generation.current) setRoom(next);
    } catch {
      if (current === generation.current) {
        setRoom(null);
        setError(true);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [api, roomId]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        generation.current++;
      };
    }, [reload]),
  );
  return { room, loading, error, reload };
}
