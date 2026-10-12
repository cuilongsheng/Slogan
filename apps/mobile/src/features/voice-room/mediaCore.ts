import { DisconnectReason, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';

import type { RealtimeCredential } from './api';
import { isRoomSafetyAlertSignal } from './safetySignal';
import type { MicrophoneCheck, PlaybackCheck } from '../../services/voiceDeviceCheck';

export type MediaConnection = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export interface MediaParticipant {
  identity: string;
  speaking: boolean;
  microphoneEnabled: boolean;
}
export interface MediaSnapshot {
  disconnectReason?: 'ended' | 'removed' | 'network' | undefined;
  timings?: {
    connectedMs?: number;
    playbackReadyMs?: number;
    firstRemoteSubscribedMs?: number;
    microphonePublishedMs?: number;
  };
  connection: MediaConnection;
  localIdentity: string | null;
  microphoneEnabled: boolean;
  audioPlaybackAllowed: boolean;
  deviceCheck?: { microphone: MicrophoneCheck; playback: PlaybackCheck } | undefined;
  participants: MediaParticipant[];
}

export interface MediaPlatform {
  start(): Promise<void>;
  stop(): Promise<void>;
  attachRemoteAudio(track: RemoteTrack): void;
  detachRemoteAudio(track: RemoteTrack): void;
  requestMicrophone?(): Promise<void>;
  checkMicrophone?(signal: AbortSignal): Promise<MicrophoneCheck>;
  checkAudioOutput?(): Promise<boolean>;
}

export class LiveKitVoiceMedia {
  private connectStartedAt = 0;
  private timings: NonNullable<MediaSnapshot['timings']> = {};
  private room: Room | null = null;
  private listeners = new Set<(snapshot: MediaSnapshot) => void>();
  private safetySignalListeners = new Set<() => void>();
  private connection: MediaConnection = 'disconnected';
  private platformStarted = false;
  private disconnectReason: MediaSnapshot['disconnectReason'];
  private deviceCheck: MediaSnapshot['deviceCheck'];
  private checkingDevices: Promise<void> | null = null;
  private deviceAbort: AbortController | null = null;
  private connectionGeneration = 0;

  constructor(private readonly platform: MediaPlatform) {}

  get snapshot(): MediaSnapshot {
    const room = this.room;
    return {
      connection: this.connection,
      disconnectReason: this.disconnectReason,
      timings: { ...this.timings },
      localIdentity: room?.localParticipant.identity ?? null,
      microphoneEnabled: room?.localParticipant.isMicrophoneEnabled ?? false,
      audioPlaybackAllowed: room?.canPlaybackAudio ?? true,
      deviceCheck: this.deviceCheck,
      participants: room
        ? [room.localParticipant, ...room.remoteParticipants.values()].map((participant) => ({
            identity: participant.identity,
            speaking: participant.isSpeaking,
            microphoneEnabled: participant.isMicrophoneEnabled,
          }))
        : [],
    };
  }

  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  subscribeSafetySignals(listener: () => void): () => void {
    this.safetySignalListeners.add(listener);
    return () => this.safetySignalListeners.delete(listener);
  }

  private emit() {
    const snapshot = this.snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async connect(
    credential: Pick<RealtimeCredential, 'serverUrl' | 'participantToken' | 'roomId'>,
  ): Promise<void> {
    const generation = this.connectionGeneration + 1;
    await this.disconnect();
    if (generation !== this.connectionGeneration) return;
    this.connectStartedAt = performance.now();
    this.timings = {};
    this.disconnectReason = undefined;
    this.connection = 'connecting';
    this.emit();
    try {
      const room = new Room({ stopLocalTrackOnUnpublish: true });
      this.room = room;
      // Best effort DNS/TLS warmup overlaps native audio setup on the same SDK Room.
      // Token-based Cloud region prefetch is intentionally not awaited on the join path.
      if (typeof room.prepareConnection === 'function')
        void room.prepareConnection(credential.serverUrl).catch(() => undefined);
      try {
        await this.platform.start();
        this.platformStarted = true;
      } catch {
        // A device problem must be visible, without preventing muted/text entry.
        this.deviceCheck = { microphone: 'checking', playback: 'unavailable' };
      }
      if (generation !== this.connectionGeneration) {
        if (this.platformStarted) {
          this.platformStarted = false;
          await this.platform.stop();
        }
        return;
      }
      const refresh = () => {
        if (this.room === room) this.emit();
      };
      room.on(RoomEvent.ParticipantConnected, refresh);
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.ActiveSpeakersChanged, refresh);
      room.on(RoomEvent.TrackMuted, refresh);
      room.on(RoomEvent.TrackUnmuted, refresh);
      room.on(RoomEvent.AudioPlaybackStatusChanged, refresh);
      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        if (this.room !== room || !isRoomSafetyAlertSignal(payload, topic, credential.roomId))
          return;
        this.safetySignalListeners.forEach((listener) => listener());
      });
      room.on(RoomEvent.Reconnecting, () => {
        if (this.room !== room) return;
        this.connection = 'reconnecting';
        this.emit();
      });
      room.on(RoomEvent.Reconnected, () => {
        if (this.room !== room) return;
        this.connection = 'connected';
        this.emit();
      });
      room.on(RoomEvent.Disconnected, (reason) => {
        if (this.room !== room) return;
        this.disconnectReason =
          reason === DisconnectReason.ROOM_DELETED
            ? 'ended'
            : [DisconnectReason.PARTICIPANT_REMOVED, DisconnectReason.DUPLICATE_IDENTITY].includes(
                  reason!,
                )
              ? 'removed'
              : 'network';
        this.connection = 'disconnected';
        this.emit();
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (this.room !== room) return;
        if (track.kind === Track.Kind.Audio) {
          this.platform.attachRemoteAudio(track);
          this.timings.firstRemoteSubscribedMs ??= Math.max(
            0,
            performance.now() - this.connectStartedAt,
          );
        }
        this.emit();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) this.platform.detachRemoteAudio(track);
        this.emit();
      });
      await room.connect(credential.serverUrl, credential.participantToken, {
        autoSubscribe: true,
      });
      if (this.room !== room || generation !== this.connectionGeneration) {
        await room.disconnect();
        return;
      }
      if (room.localParticipant.isMicrophoneEnabled) {
        await room.localParticipant.setMicrophoneEnabled(false);
      }
      this.connection = 'connected';
      this.timings.connectedMs = Math.max(0, performance.now() - this.connectStartedAt);
      this.emit();
      void this.checkDevices();
    } catch (error) {
      if (generation !== this.connectionGeneration) return;
      await this.disconnect();
      throw error;
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room || this.connection !== 'connected') return;
    const room = this.room;
    // The unpublished probe must release its track before room/private capture.
    await this.checkingDevices;
    if (this.room !== room || this.connection !== 'connected') return;
    if (enabled) await this.platform.requestMicrophone?.();
    if (this.room !== room || this.connection !== 'connected') return;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    if (this.room !== room || this.connection !== 'connected') return;
    if (enabled && room.localParticipant.isMicrophoneEnabled)
      this.timings.microphonePublishedMs ??= Math.max(0, performance.now() - this.connectStartedAt);
    if (enabled && this.deviceCheck)
      this.deviceCheck = { ...this.deviceCheck, microphone: 'ready' };
    this.emit();
  }

  async startAudio(): Promise<void> {
    if (!this.room) return;
    await this.room.startAudio();
    if (this.platformStarted && (this.room.canPlaybackAudio ?? true))
      this.timings.playbackReadyMs ??= Math.max(0, performance.now() - this.connectStartedAt);
    this.emit();
  }

  checkDevices(): Promise<void> {
    if (this.checkingDevices) return this.checkingDevices;
    const room = this.room;
    if (!room || this.connection !== 'connected') return Promise.resolve();
    const abort = new AbortController();
    this.deviceAbort = abort;
    this.deviceCheck = { microphone: 'checking', playback: 'checking' };
    this.emit();
    const microphone = async (): Promise<MicrophoneCheck> => {
      // Do not open a second stream if the user already explicitly published one.
      if (room.localParticipant.isMicrophoneEnabled) return 'ready';
      try {
        return (await this.platform.checkMicrophone?.(abort.signal)) ?? 'unavailable';
      } catch {
        return 'unavailable';
      }
    };
    const playback = async (): Promise<PlaybackCheck> => {
      try {
        if (!this.platformStarted) {
          await this.platform.start();
          if (abort.signal.aborted || this.room !== room) {
            await this.platform.stop();
            return 'unavailable';
          }
          this.platformStarted = true;
        }
        const ready = (await this.platform.checkAudioOutput?.()) ?? false;
        if (ready && !abort.signal.aborted && this.room === room && (room.canPlaybackAudio ?? true))
          this.timings.playbackReadyMs ??= Math.max(0, performance.now() - this.connectStartedAt);
        return ready ? 'ready' : 'unavailable';
      } catch {
        return 'unavailable';
      }
    };
    const pending = Promise.all([microphone(), playback()])
      .then(([microphone, playback]) => {
        if (abort.signal.aborted || this.room !== room) return;
        this.deviceCheck = { microphone, playback };
        this.emit();
      })
      .finally(() => {
        if (this.checkingDevices === pending) this.checkingDevices = null;
      });
    this.checkingDevices = pending;
    return pending;
  }

  async disconnect(): Promise<void> {
    this.connectionGeneration++;
    this.deviceAbort?.abort();
    this.deviceAbort = null;
    this.checkingDevices = null;
    this.deviceCheck = undefined;
    const room = this.room;
    this.room = null;
    this.connection = 'disconnected';
    if (room) {
      // Stop local capture synchronously before waiting for provider disconnect.
      for (const publication of room.localParticipant.audioTrackPublications.values())
        publication.track?.stop();
      for (const participant of room.remoteParticipants.values())
        for (const publication of participant.audioTrackPublications.values())
          if (publication.track) this.platform.detachRemoteAudio(publication.track);
    }
    const stopping = this.platformStarted ? this.platform.stop() : Promise.resolve();
    this.platformStarted = false;
    this.emit();
    // Release native output ownership even if provider disconnect stalls or fails.
    await Promise.allSettled([stopping, ...(room ? [room.disconnect()] : [])]);
  }
}
