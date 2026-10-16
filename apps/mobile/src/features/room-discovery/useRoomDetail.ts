import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusedLive } from '../live-updates';

import { useAuth } from '../auth';
import { RoomDiscoveryApi, type RoomDetail } from './api';

export function useRoomDetail(roomId: string) {
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomDiscoveryApi(authorized), [authorized]);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(
    async (active: () => boolean) => {
      const current = ++generation.current;
      setLoading(true);
      setError(false);
      try {
        const next = await api.detail(roomId);
        if (current === generation.current && active()) setRoom(next);
      } catch {
        if (current === generation.current && active()) {
          setRoom(null);
          setError(true);
        }
      } finally {
        if (current === generation.current && active()) setLoading(false);
      }
    },
    [api, roomId],
  );
  const fence = useFocusedLive(refresh, 'rooms');
  const reload = useCallback(() => refresh(fence()), [refresh, fence]);
  return { room, loading, error, reload };
}
