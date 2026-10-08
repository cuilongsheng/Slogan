import { RoomApiError } from '../room-discovery/api';
import type { RoomSafetyAlert, RoomSafetyAlertPage } from './api';
import { VoiceRoomSession } from './session';

function setup(active = false) {
  const membership = {
    id: 'member-1',
    lifecycle: 'ACTIVE',
    role: 'MEMBER',
    credentialVersion: 3,
  };
  const room = {
    id: 'room-1',
    topic: 'Travel',
    passwordProtected: true,
    currentMembership: active ? membership : null,
    sensitiveSpeechDetectionEnabled: false,
  };
  const rooms = { detail: jest.fn(async () => room) };
  const api = {
    join: jest.fn(async () => ({ currentMembership: membership })),
    credentials: jest.fn(async () => ({
      serverUrl: 'wss://example.invalid',
      participantToken: 'short-lived',
      credentialVersion: 3,
      role: 'MEMBER',
    })),
    members: jest.fn(async () => []),
    leave: jest.fn(async () => ({ lifecycle: 'LEFT', roomStatus: 'OPEN' })),
    end: jest.fn(),
    safetyAlerts: jest.fn(async (): Promise<RoomSafetyAlertPage> => ({
      items: [],
      nextCursor: null,
    })),
  };
  let mediaListener: (() => void) | null = null;
  const media = {
    snapshot: {
      connection: 'disconnected',
      localIdentity: null,
      microphoneEnabled: false,
      participants: [],
    },
    subscribe: jest.fn((listener: () => void) => {
      mediaListener = listener;
      return () => {
        mediaListener = null;
      };
    }),
    subscribeSafetySignals: jest.fn(() => () => undefined),
    connect: jest.fn(async () => undefined),
    setMicrophoneEnabled: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
  };
  const session = new VoiceRoomSession('room-1', rooms as never, api as never, media as never);
  return { room, rooms, api, media, session, emitMedia: () => mediaListener?.() };
}

describe('voice room admission and recovery', () => {
  it('does not query safety alerts for an ordinary member even in an enabled room', async () => {
    const { room, api, media, session } = setup(true);
    room.sensitiveSpeechDetectionEnabled = true;
    media.snapshot.connection = 'connected';
    await session.start(null);
    await session.refreshSafetyAlerts();
    expect(api.safetyAlerts).not.toHaveBeenCalled();
  });

  it('hides host alerts when room access is refused', async () => {
    const { room, rooms, api, media, session } = setup(true);
    room.currentMembership!.role = 'HOST';
    room.sensitiveSpeechDetectionEnabled = true;
    media.snapshot.connection = 'connected';
    api.credentials.mockResolvedValueOnce({
      serverUrl: 'wss://example.invalid',
      participantToken: 'short-lived',
      credentialVersion: 3,
      role: 'HOST',
    });
    await session.start(null);
    rooms.detail.mockRejectedValueOnce(new RoomApiError(403, 'FORBIDDEN'));
    await session.refresh();
    expect(session.snapshot.safetyAlerts).toEqual([]);
    expect(session.snapshot.safetyAlertsDenied).toBe(true);
  });

  it('clears alerts during reconnect and reloads after server role confirmation', async () => {
    const { room, api, media, session, emitMedia } = setup(true);
    room.currentMembership!.role = 'HOST';
    room.sensitiveSpeechDetectionEnabled = true;
    media.snapshot.connection = 'connected';
    api.credentials.mockResolvedValueOnce({
      serverUrl: 'wss://example.invalid',
      participantToken: 'short-lived',
      credentialVersion: 3,
      role: 'HOST',
    });
    const alert: RoomSafetyAlert = {
      id: 'alert-1',
      roomId: 'room-1',
      subjectUserId: 'user-2',
      category: 'HARASSMENT_ABUSE',
      severity: 'LOW',
      ruleSetVersion: 'v1',
      firstOccurredAt: '2026-09-30T00:00:00Z',
      lastOccurredAt: '2026-09-30T00:00:00Z',
      occurrenceCount: 1,
      noticeCode: 'REQUIRES_HUMAN_REVIEW',
    };
    api.safetyAlerts.mockResolvedValue({ items: [alert], nextCursor: null });
    await session.start(null);
    await session.refreshSafetyAlerts();
    expect(session.snapshot.safetyAlerts).toEqual([alert]);
    media.snapshot.connection = 'reconnecting';
    emitMedia();
    expect(session.snapshot.safetyAlerts).toEqual([]);
    media.snapshot.connection = 'connected';
    emitMedia();
    await session.refresh();
    await session.refreshSafetyAlerts();
    expect(session.snapshot.safetyAlerts).toEqual([alert]);
  });

  it('queries alerts only for an enabled current host and clears them after succession', async () => {
    const { room, api, media, session } = setup(true);
    room.currentMembership!.role = 'HOST';
    room.sensitiveSpeechDetectionEnabled = true;
    media.snapshot.connection = 'connected';
    api.credentials.mockResolvedValueOnce({
      serverUrl: 'wss://example.invalid',
      participantToken: 'short-lived',
      credentialVersion: 3,
      role: 'HOST',
    });
    const alert: RoomSafetyAlert = {
      id: 'alert-1',
      roomId: 'room-1',
      subjectUserId: 'user-2',
      category: 'HARASSMENT_ABUSE',
      severity: 'MEDIUM',
      ruleSetVersion: 'v1',
      firstOccurredAt: '2026-09-30T00:00:00Z',
      lastOccurredAt: '2026-09-30T00:00:00Z',
      occurrenceCount: 1,
      noticeCode: 'REQUIRES_HUMAN_REVIEW',
    };
    api.safetyAlerts.mockResolvedValue({ items: [alert], nextCursor: null });
    await session.start(null);
    await session.refreshSafetyAlerts();
    expect(api.safetyAlerts).toHaveBeenCalledWith('room-1', undefined);
    expect(session.snapshot.safetyAlerts).toEqual([alert]);

    room.currentMembership!.role = 'MEMBER';
    await session.refresh();
    expect(session.snapshot.safetyAlerts).toEqual([]);
    expect(session.snapshot.role).toBe('MEMBER');
    const calls = api.safetyAlerts.mock.calls.length;
    await session.refreshSafetyAlerts();
    expect(api.safetyAlerts).toHaveBeenCalledTimes(calls);
  });

  it('does not restore a former host alert from an in-flight request', async () => {
    const { room, api, media, session } = setup(true);
    room.currentMembership!.role = 'HOST';
    room.sensitiveSpeechDetectionEnabled = true;
    media.snapshot.connection = 'connected';
    api.credentials.mockResolvedValueOnce({
      serverUrl: 'wss://example.invalid',
      participantToken: 'short-lived',
      credentialVersion: 3,
      role: 'HOST',
    });
    await session.start(null);
    let resolvePage!: (value: RoomSafetyAlertPage) => void;
    api.safetyAlerts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        }),
    );
    const request = session.refreshSafetyAlerts();
    room.currentMembership!.role = 'MEMBER';
    await session.refresh();
    resolvePage({
      items: [
        {
          id: 'stale-alert',
          roomId: 'room-1',
          subjectUserId: 'user-2',
          category: 'HARASSMENT_ABUSE',
          severity: 'LOW',
          ruleSetVersion: 'v1',
          firstOccurredAt: '2026-09-30T00:00:00Z',
          lastOccurredAt: '2026-09-30T00:00:00Z',
          occurrenceCount: 1,
          noticeCode: 'REQUIRES_HUMAN_REVIEW',
        },
      ],
      nextCursor: null,
    });
    await request;
    expect(session.snapshot.safetyAlerts).toEqual([]);
  });

  it('does not reserve a seat without active rule confirmation', async () => {
    const { session, api, media } = setup();
    await session.start(null);
    expect(session.snapshot.phase).toBe('preparationRequired');
    expect(api.join).not.toHaveBeenCalled();
    expect(media.connect).not.toHaveBeenCalled();
  });

  it('can leave an admitted seat when the provider is unavailable', async () => {
    const { session, api, media } = setup();
    api.credentials.mockRejectedValueOnce(new RoomApiError(503, 'REALTIME_PROVIDER_UNAVAILABLE'));
    await session.start({ roomId: 'room-1', password: '1234', rulesAccepted: true });
    expect(api.join).toHaveBeenCalledWith('room-1', {
      rulesAccepted: true,
      password: '1234',
    });
    expect(session.snapshot.phase).toBe('failed');
    expect(session.snapshot.credentialVersion).toBe(3);
    expect(media.connect).not.toHaveBeenCalled();

    await session.leave();
    expect(api.leave).toHaveBeenCalledWith('room-1', 3, undefined);
    expect(session.snapshot.phase).toBe('left');
  });

  it('restores an existing membership without resending the password', async () => {
    const { session, api, media } = setup(true);
    await session.start(null);
    expect(api.join).not.toHaveBeenCalled();
    expect(api.credentials).toHaveBeenCalledWith('room-1');
    expect(media.connect).toHaveBeenCalledTimes(1);
    expect(session.snapshot.phase).toBe('active');
  });

  it('passes the selected online successor through the leave command', async () => {
    const { session, api } = setup(true);
    await session.start(null);
    await session.leave('member-2');
    expect(api.leave).toHaveBeenCalledWith('room-1', 3, 'member-2');
  });

  it('coalesces repeated admission taps into one membership request', async () => {
    const { session, api } = setup();
    const draft = { roomId: 'room-1', password: '1234', rulesAccepted: true };
    await Promise.all([session.start(draft), session.start(draft)]);
    expect(api.join).toHaveBeenCalledTimes(1);
    expect(api.credentials).toHaveBeenCalledTimes(1);
  });

  it('carries a received invitation through the ordinary membership admission', async () => {
    const { session, api } = setup();
    await session.start({
      roomId: 'room-1',
      password: '1234',
      rulesAccepted: true,
      invitationId: 'invite-1',
    });
    expect(api.join).toHaveBeenCalledWith('room-1', {
      rulesAccepted: true,
      password: '1234',
      invitationId: 'invite-1',
    });
  });

  it('disconnects when a refreshed membership is no longer active', async () => {
    const { session, rooms, media, room } = setup(true);
    await session.start(null);
    rooms.detail.mockResolvedValueOnce({
      ...room,
      currentMembership: { ...room.currentMembership!, lifecycle: 'REMOVED' },
    });
    await session.refresh();
    expect(session.snapshot.phase).toBe('ended');
    expect(media.disconnect).toHaveBeenCalled();
  });

  it('stops local audio before ending and never treats a failed end as confirmed', async () => {
    const { session, api, media, room } = setup(true);
    room.currentMembership = { ...room.currentMembership!, role: 'HOST' };
    api.credentials.mockResolvedValueOnce({
      serverUrl: 'wss://example.invalid',
      participantToken: 'short-lived',
      credentialVersion: 3,
      role: 'HOST',
    });
    await session.start(null);
    api.end.mockRejectedValueOnce(new RoomApiError(409, 'ROOM_OPERATION_CONFLICT'));
    await session.end();
    expect(media.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    expect(media.disconnect).toHaveBeenCalled();
    expect(session.snapshot.phase).toBe('failed');
    expect(session.snapshot.errorCode).toBe('ROOM_OPERATION_CONFLICT');
  });
});

describe('fast leaving', () => {
  it('does not wait for stuck media shutdown or start a second leave', async () => {
    const { session, api, media } = setup(true);
    await session.start(null);
    media.disconnect.mockImplementationOnce(() => new Promise<undefined>(() => {}));
    await session.leave();
    await session.leave();
    expect(api.leave).toHaveBeenCalledTimes(1);
    expect(session.snapshot.phase).toBe('left');
  });
  it('retries the original generation and successor after a lost response without rejoining', async () => {
    const { session, api } = setup(true);
    await session.start(null);
    api.leave.mockRejectedValueOnce(new Error('response lost'));
    await session.leave('successor-1');
    expect(session.snapshot.phase).toBe('leaveUnconfirmed');
    await session.start(null);
    await session.leave();
    expect(api.credentials).toHaveBeenCalledTimes(1);
    expect(api.join).not.toHaveBeenCalled();
    expect(api.leave.mock.calls).toEqual([
      ['room-1', 3, 'successor-1'],
      ['room-1', 3, 'successor-1'],
    ]);
    expect(session.snapshot.phase).toBe('left');
  });
});
