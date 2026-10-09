import type { RoomDetail } from '../room-discovery/api';
import { RoomApiError } from '../room-discovery/api';
import { validRoomPassword, type JoinDraft } from '../room-discovery/join';
import type { MediaSnapshot, LiveKitVoiceMedia } from './mediaCore';
import type { RoomMember, RoomSafetyAlert, VoiceRoomApi } from './api';

export type VoicePhase =
  | 'idle'
  | 'joining'
  | 'connecting'
  | 'active'
  | 'failed'
  | 'leaveUnconfirmed'
  | 'leaving'
  | 'left'
  | 'ended'
  | 'preparationRequired';

export interface VoiceSessionSnapshot {
  phase: VoicePhase;
  room: RoomDetail | null;
  members: RoomMember[];
  media: MediaSnapshot;
  errorCode: string | null;
  credentialVersion: number | null;
  role: 'HOST' | 'MEMBER' | null;
  safetyAlerts: RoomSafetyAlert[];
  safetyAlertsCursor: string | null;
  safetyAlertsLoading: boolean;
  safetyAlertsError: boolean;
  safetyAlertsDenied: boolean;
}

type RoomReader = Pick<{ detail(roomId: string): Promise<RoomDetail> }, 'detail'>;
type VoiceApi = Pick<
  VoiceRoomApi,
  'join' | 'credentials' | 'members' | 'leave' | 'end' | 'safetyAlerts'
>;
type Media = Pick<
  LiveKitVoiceMedia,
  | 'snapshot'
  | 'subscribe'
  | 'subscribeSafetySignals'
  | 'connect'
  | 'setMicrophoneEnabled'
  | 'startAudio'
  | 'disconnect'
> &
  Partial<Pick<LiveKitVoiceMedia, 'checkDevices'>>;

function errorCode(error: unknown): string {
  return error instanceof RoomApiError ? error.code : 'NETWORK_ERROR';
}

export class VoiceRoomSession {
  private listeners = new Set<(snapshot: VoiceSessionSnapshot) => void>();
  private state: Omit<VoiceSessionSnapshot, 'media'> = {
    phase: 'idle',
    room: null,
    members: [],
    errorCode: null,
    credentialVersion: null,
    role: null,
    safetyAlerts: [],
    safetyAlertsCursor: null,
    safetyAlertsLoading: false,
    safetyAlertsError: false,
    safetyAlertsDenied: false,
  };
  private pending: Promise<void> | null = null;
  private mediaUnsubscribe: () => void;
  private safetyUnsubscribe: () => void;
  private safetyGeneration = 0;
  private roomRefreshGeneration = 0;
  private refreshPending: Promise<void> | null = null;
  private disposed = false;
  private leavingSuccessor: string | undefined;

  constructor(
    private readonly roomId: string,
    private readonly rooms: RoomReader,
    private readonly api: VoiceApi,
    private readonly media: Media,
  ) {
    this.mediaUnsubscribe = media.subscribe(() => {
      if (
        media.snapshot.connection === 'reconnecting' ||
        media.snapshot.connection === 'disconnected'
      ) {
        this.clearSafetyAlerts();
      }
      this.emit();
    });
    this.safetyUnsubscribe = media.subscribeSafetySignals(() => {
      void this.refreshSafetyAlerts();
    });
  }

  get snapshot(): VoiceSessionSnapshot {
    return { ...this.state, media: this.media.snapshot };
  }

  subscribe(listener: (snapshot: VoiceSessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    if (this.disposed) return;
    const snapshot = this.snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private update(patch: Partial<Omit<VoiceSessionSnapshot, 'media'>>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private clearSafetyAlerts() {
    this.safetyGeneration += 1;
    this.state = {
      ...this.state,
      safetyAlerts: [],
      safetyAlertsCursor: null,
      safetyAlertsLoading: false,
      safetyAlertsError: false,
      safetyAlertsDenied: false,
    };
  }

  async refreshSafetyAlerts(cursor?: string): Promise<void> {
    if (
      this.disposed ||
      this.state.phase !== 'active' ||
      this.state.role !== 'HOST' ||
      !this.state.room?.sensitiveSpeechDetectionEnabled ||
      this.media.snapshot.connection !== 'connected' ||
      (cursor && cursor !== this.state.safetyAlertsCursor)
    )
      return;
    const generation = ++this.safetyGeneration;
    this.update({ safetyAlertsLoading: true, safetyAlertsError: false });
    try {
      const page = await this.api.safetyAlerts(this.roomId, cursor);
      if (
        this.disposed ||
        generation !== this.safetyGeneration ||
        this.state.phase !== 'active' ||
        this.state.role !== 'HOST' ||
        !this.state.room?.sensitiveSpeechDetectionEnabled ||
        this.media.snapshot.connection !== 'connected'
      )
        return;
      const items = cursor ? [...this.state.safetyAlerts, ...page.items] : page.items;
      this.update({
        safetyAlerts: items.filter(
          (item, index) => items.findIndex((candidate) => candidate.id === item.id) === index,
        ),
        safetyAlertsCursor: page.nextCursor,
        safetyAlertsLoading: false,
        safetyAlertsError: false,
        safetyAlertsDenied: false,
      });
    } catch (error) {
      if (this.disposed || generation !== this.safetyGeneration) return;
      if (error instanceof RoomApiError && error.status === 403) {
        this.clearSafetyAlerts();
        this.update({ safetyAlertsDenied: true });
      } else {
        this.update({ safetyAlertsLoading: false, safetyAlertsError: true });
      }
    }
  }

  start(draft: JoinDraft | null): Promise<void> {
    if (this.pending) return this.pending;
    if (
      (this.state.phase === 'active' && this.media.snapshot.connection !== 'disconnected') ||
      ['ended', 'left', 'leaving', 'leaveUnconfirmed'].includes(this.state.phase) ||
      this.disposed
    ) {
      return Promise.resolve();
    }
    const operation = this.enter(draft).finally(() => {
      if (this.pending === operation) this.pending = null;
    });
    this.pending = operation;
    return operation;
  }

  private async enter(draft: JoinDraft | null): Promise<void> {
    this.update({ phase: 'joining', errorCode: null });
    try {
      const room = await this.rooms.detail(this.roomId);
      this.update({ room });
      const membership = room.currentMembership;
      const active = membership?.lifecycle === 'ACTIVE';
      if (!active) {
        if (
          room.passwordProtected &&
          !validRoomPassword(draft?.roomId === this.roomId ? draft.password : '')
        ) {
          this.update({ phase: 'failed', errorCode: 'ROOM_PASSWORD_REQUIRED' });
          return;
        }
        const joined = await this.api.join(this.roomId, {
          rulesAccepted: true,
          ...(room.passwordProtected ? { password: draft?.password ?? '' } : {}),
          ...(draft?.roomId === this.roomId && draft.invitationId
            ? { invitationId: draft.invitationId }
            : {}),
        });
        if (joined.currentMembership?.lifecycle !== 'ACTIVE') {
          throw new RoomApiError(409, 'ROOM_MEMBER_NOT_ACTIVE');
        }
        this.update({
          credentialVersion: joined.currentMembership.credentialVersion,
          role: joined.currentMembership.role,
        });
      } else if (membership) {
        this.update({
          credentialVersion: membership.credentialVersion,
          role: membership.role,
        });
      }
      this.update({ phase: 'connecting' });
      const credential = await this.api.credentials(this.roomId);
      this.update({ credentialVersion: credential.credentialVersion, role: credential.role });
      try {
        await this.media.connect(credential);
      } catch {
        throw new RoomApiError(0, 'REALTIME_CONNECT_FAILED');
      }
      const members = await this.api.members(this.roomId);
      this.update({ phase: 'active', members, errorCode: null });
      void this.refreshSafetyAlerts();
    } catch (error) {
      const code = errorCode(error);
      if (['ROOM_ENDED', 'ROOM_CANCELLED'].includes(code)) {
        await this.media.disconnect();
        this.update({ phase: 'ended', errorCode: code });
      } else {
        this.update({ phase: 'failed', errorCode: code });
      }
    }
  }

  refresh(): Promise<void> {
    if (this.refreshPending) return this.refreshPending;
    const pending = this.refreshRoom().finally(() => {
      if (this.refreshPending === pending) this.refreshPending = null;
    });
    this.refreshPending = pending;
    return pending;
  }

  private async refreshRoom(): Promise<void> {
    if (
      this.disposed ||
      ['left', 'ended', 'leaving', 'leaveUnconfirmed'].includes(this.state.phase)
    )
      return;
    const generation = ++this.roomRefreshGeneration;
    try {
      const room = await this.rooms.detail(this.roomId);
      if (this.disposed || generation !== this.roomRefreshGeneration) return;
      if (room.currentMembership?.lifecycle !== 'ACTIVE') {
        this.clearSafetyAlerts();
        await this.media.disconnect();
        this.update({ phase: 'ended', room, members: [], errorCode: 'ROOM_MEMBER_NOT_ACTIVE' });
        return;
      }
      const members = await this.api.members(this.roomId);
      if (
        this.disposed ||
        generation !== this.roomRefreshGeneration ||
        ['leaving', 'leaveUnconfirmed'].includes(this.state.phase)
      )
        return;
      const isCurrentHost =
        room.currentMembership.role === 'HOST' && room.sensitiveSpeechDetectionEnabled;
      if (!isCurrentHost || this.state.role !== 'HOST') this.clearSafetyAlerts();
      this.update({
        room,
        members,
        credentialVersion: room.currentMembership.credentialVersion,
        role: room.currentMembership.role,
      });
      if (isCurrentHost) void this.refreshSafetyAlerts();
    } catch (error) {
      if (
        this.disposed ||
        generation !== this.roomRefreshGeneration ||
        ['leaving', 'leaveUnconfirmed'].includes(this.state.phase)
      )
        return;
      if (error instanceof RoomApiError && error.status === 403) {
        this.clearSafetyAlerts();
        this.update({ safetyAlertsDenied: true });
      }
      const code = errorCode(error);
      if (['ROOM_ENDED', 'ROOM_CANCELLED', 'ROOM_MEMBER_NOT_ACTIVE'].includes(code)) {
        this.clearSafetyAlerts();
        await this.media.disconnect();
        this.update({ phase: 'ended', members: [], errorCode: code });
      } else {
        this.update({ errorCode: code });
      }
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (this.state.phase !== 'active') return;
    try {
      await this.media.setMicrophoneEnabled(enabled);
      this.update({ errorCode: null });
    } catch {
      this.update({ errorCode: 'MICROPHONE_UNAVAILABLE' });
    }
  }

  async recheckDevices(): Promise<void> {
    if (this.state.phase === 'active') await this.media.checkDevices?.();
  }

  async enableAudioPlayback(): Promise<void> {
    try {
      await this.media.startAudio();
      this.update({ errorCode: null });
    } catch {
      this.update({ errorCode: 'AUDIO_PLAYBACK_BLOCKED' });
    }
  }

  async leave(successorMembershipId?: string): Promise<void> {
    if (this.pending) return this.pending;
    if (['left', 'ended'].includes(this.state.phase)) return;
    if (successorMembershipId) this.leavingSuccessor = successorMembershipId;
    const operation = this.exit(this.leavingSuccessor).finally(() => {
      if (this.pending === operation) this.pending = null;
    });
    this.pending = operation;
    return operation;
  }

  private async exit(successorMembershipId?: string): Promise<void> {
    this.roomRefreshGeneration += 1;
    this.clearSafetyAlerts();
    this.update({ phase: 'leaving', errorCode: null });
    try {
      // Start local shutdown immediately; server leave must not wait for media I/O.
      void this.media.setMicrophoneEnabled(false).catch(() => undefined);
      void this.media.disconnect().catch(() => undefined);
      if (this.state.credentialVersion !== null) {
        const result = await this.api.leave(
          this.roomId,
          this.state.credentialVersion,
          successorMembershipId,
        );
        if (!['LEFT', 'REMOVED'].includes(result.lifecycle) && result.roomStatus !== 'ENDED') {
          throw new RoomApiError(409, 'ROOM_LEAVE_UNCONFIRMED');
        }
      }
      this.update({ phase: 'left', members: [], credentialVersion: null, errorCode: null });
    } catch (error) {
      if (errorCode(error) === 'ROOM_SUCCESSOR_INVALID') {
        this.leavingSuccessor = undefined;
        // Refresh successor candidates without reconnecting audio or issuing credentials.
        try {
          this.update({ members: await this.api.members(this.roomId) });
        } catch {
          /* retry retains exit state */
        }
      }
      this.update({ phase: 'leaveUnconfirmed', errorCode: errorCode(error) });
    }
  }

  end(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.state.role !== 'HOST') return Promise.resolve();
    const operation = this.finishEnd().finally(() => {
      if (this.pending === operation) this.pending = null;
    });
    this.pending = operation;
    return operation;
  }

  private async finishEnd(): Promise<void> {
    this.roomRefreshGeneration += 1;
    this.clearSafetyAlerts();
    this.update({ phase: 'leaving', errorCode: null });
    try {
      await this.media.setMicrophoneEnabled(false);
      await this.media.disconnect();
      const result = await this.api.end(this.roomId);
      if (!['ENDING', 'ENDED'].includes(result.roomStatus)) {
        throw new RoomApiError(409, 'ROOM_END_UNCONFIRMED');
      }
      this.update({ phase: 'ended', members: [], credentialVersion: null });
    } catch (error) {
      this.update({ phase: 'failed', errorCode: errorCode(error) });
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.roomRefreshGeneration += 1;
    this.clearSafetyAlerts();
    this.mediaUnsubscribe();
    this.safetyUnsubscribe();
    this.listeners.clear();
    await this.media.disconnect();
  }
}
