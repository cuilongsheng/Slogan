import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth';
import { VoiceRoomApi } from './api';
import { RoomExitQueue } from './exitQueue';
import { roomExitStorage } from '../../services/roomExitStorage';
const Context = createContext<{ queue: RoomExitQueue | null; revision: number; failed: boolean }>({
  queue: null,
  revision: 0,
  failed: false,
});
export function RoomExitProvider({ children }: { children: ReactNode }) {
  const { state, authorized } = useAuth();
  const userId = state.kind === 'signedIn' ? state.me.userId : null;
  const actor = useRef(userId);
  useLayoutEffect(() => {
    actor.current = userId;
  }, [userId]);
  const [revision, setRevision] = useState(0),
    [failure, setFailure] = useState<{ userId: string; failed: boolean } | null>(null);
  const queue = useMemo(
    () =>
      userId
        ? new RoomExitQueue(
            userId,
            new VoiceRoomApi((request) =>
              authorized((token) => {
                if (actor.current !== userId) throw new Error('EXIT_ACCOUNT_CHANGED');
                return request(token);
              }),
            ),
            roomExitStorage,
            (error) => {
              if (actor.current === userId) {
                setFailure({ userId, failed: error });
                setRevision((value) => value + 1);
              }
            },
          )
        : null,
    [authorized, userId],
  );
  useEffect(() => {
    void queue?.flush();
    const subscription = AppState.addEventListener('change', (value) => {
      if (value === 'active') void queue?.flush();
    });
    return () => {
      subscription.remove();
      queue?.stop();
    };
  }, [queue]);
  return (
    <Context.Provider
      value={{ queue, revision, failed: failure?.userId === userId && failure.failed }}
    >
      {children}
    </Context.Provider>
  );
}
export const useRoomExitDelivery = () => useContext(Context);
