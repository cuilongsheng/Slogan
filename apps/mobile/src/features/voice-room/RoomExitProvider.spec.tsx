import { useLayoutEffect } from 'react';
import { act, render } from '@testing-library/react-native';
import { useAuth } from '../auth';
import { VoiceRoomApi } from './api';
import { RoomExitProvider, useRoomExitDelivery } from './RoomExitProvider';
import { roomExitStorage } from '../../services/roomExitStorage';
import type { RoomExitQueue } from './exitQueue';
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('./api', () => ({ VoiceRoomApi: jest.fn() }));
jest.mock('../../services/roomExitStorage', () => ({
  roomExitStorage: { get: jest.fn(), set: jest.fn() },
}));

it('guards a delayed authorization callback from sending the old exit with the next account token', async () => {
  const records = new Map<string, string>();
  (roomExitStorage.get as jest.Mock).mockImplementation(
    async (key: string) => records.get(key) ?? null,
  );
  (roomExitStorage.set as jest.Mock).mockImplementation(async (key: string, value: string) => {
    records.set(key, value);
  });
  let authorize!: () => void;
  const authorization = jest.fn(
    (request: (token: string) => unknown) =>
      new Promise((resolve, reject) => {
        authorize = () => {
          try {
            resolve(request('next-account-token'));
          } catch (error) {
            reject(error);
          }
        };
      }),
  );
  const sent = jest.fn(async () => ({ lifecycle: 'LEFT', roomStatus: 'OPEN' }));
  (VoiceRoomApi as jest.Mock).mockImplementation(
    (request: (callback: (token: string) => unknown) => unknown) => ({
      leave: () => request(sent),
      end: () => request(sent),
    }),
  );
  (useAuth as jest.Mock).mockReturnValue({
    authorized: authorization,
    state: { kind: 'signedIn', me: { userId: 'actor-a' } },
  });
  let current: RoomExitQueue | null = null;
  function Probe() {
    const { queue } = useRoomExitDelivery();
    useLayoutEffect(() => {
      current = queue;
    }, [queue]);
    return null;
  }
  const page = await render(
    <RoomExitProvider>
      <Probe />
    </RoomExitProvider>,
  );
  const oldQueue = current! as RoomExitQueue;
  let pending!: Promise<void>;
  await act(async () => {
    oldQueue.enqueue({ roomId: 'room-a', action: 'leave', expectedCredentialVersion: 3 });
    pending = oldQueue.flush();
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
  expect(authorization).toHaveBeenCalledTimes(1);
  (useAuth as jest.Mock).mockReturnValue({
    authorized: authorization,
    state: { kind: 'signedIn', me: { userId: 'actor-b' } },
  });
  await page.rerender(
    <RoomExitProvider>
      <Probe />
    </RoomExitProvider>,
  );
  await act(async () => {
    authorize();
    await pending;
  });
  expect(sent).not.toHaveBeenCalled();
  expect(JSON.parse(records.get('slogan.roomExits.actor-a')!)).toMatchObject([
    { roomId: 'room-a', expectedCredentialVersion: 3 },
  ]);
  expect(records.get('slogan.roomExits.actor-b')).toBe('[]');
  await page.unmount();
});
