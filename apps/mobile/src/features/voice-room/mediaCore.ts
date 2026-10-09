import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';

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
  private room: Room | null = null;
  private listeners = new Set<(snapshot: MediaSnapshot) => void>();
  private safetySignalListeners = new Set<() => void>();
  private connection: MediaConnection = 'disconnected';
  private platformStarted = false;
  private deviceCheck: MediaSnapshot['deviceCheck'];
  private checkingDevices: Promise<void> | null = null;
  private deviceAbort: AbortController | null = null;
  private connectionGeneration = 0;

  constructor(private readonly platform: MediaPlatform) {}

  get snapshot(): MediaSnapshot {
    const room = this.room;
    return {
      connection: this.connection,
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

  async connect(credential: RealtimeCredential): Promise<void> {
    await this.disconnect();
    const generation = this.connectionGeneration;
    this.connection = 'connecting';
    this.emit();
    try {
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
      const room = new Room({ stopLocalTrackOnUnpublish: true });
      this.room = room;
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
      room.on(RoomEvent.Disconnected, () => {
        if (this.room !== room) return;
        this.connection = 'disconnected';
        this.emit();
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (this.room !== room) return;
        if (track.kind === Track.Kind.Audio) this.platform.attachRemoteAudio(track);
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
    if (enabled && this.deviceCheck)
      this.deviceCheck = { ...this.deviceCheck, microphone: 'ready' };
    this.emit();
  }

  async startAudio(): Promise<void> {
    if (!this.room) return;
    await this.room.startAudio();
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
        return ((await this.platform.checkAudioOutput?.()) ?? false) ? 'ready' : 'unavailable';
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
    if (room) await room.disconnect();
    if (this.platformStarted) {
      this.platformStarted = false;
      await this.platform.stop();
    }
    this.emit();
  }
}
