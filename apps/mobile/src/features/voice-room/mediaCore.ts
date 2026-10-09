import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';

import type { RealtimeCredential } from './api';
import { isRoomSafetyAlertSignal } from './safetySignal';

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
  participants: MediaParticipant[];
}

export interface MediaPlatform {
  start(): Promise<void>;
  stop(): Promise<void>;
  attachRemoteAudio(track: RemoteTrack): void;
  detachRemoteAudio(track: RemoteTrack): void;
  requestMicrophone?(): Promise<void>;
}

export class LiveKitVoiceMedia {
  private room: Room | null = null;
  private listeners = new Set<(snapshot: MediaSnapshot) => void>();
  private safetySignalListeners = new Set<() => void>();
  private connection: MediaConnection = 'disconnected';
  private platformStarted = false;

  constructor(private readonly platform: MediaPlatform) {}

  get snapshot(): MediaSnapshot {
    const room = this.room;
    return {
      connection: this.connection,
      localIdentity: room?.localParticipant.identity ?? null,
      microphoneEnabled: room?.localParticipant.isMicrophoneEnabled ?? false,
      audioPlaybackAllowed: room?.canPlaybackAudio ?? true,
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
    this.connection = 'connecting';
    this.emit();
    try {
      await this.platform.start();
      this.platformStarted = true;
      const room = new Room({ stopLocalTrackOnUnpublish: true });
      this.room = room;
      const refresh = () => this.emit();
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
        this.connection = 'reconnecting';
        this.emit();
      });
      room.on(RoomEvent.Reconnected, () => {
        this.connection = 'connected';
        this.emit();
      });
      room.on(RoomEvent.Disconnected, () => {
        this.connection = 'disconnected';
        this.emit();
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
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
      if (room.localParticipant.isMicrophoneEnabled) {
        await room.localParticipant.setMicrophoneEnabled(false);
      }
      this.connection = 'connected';
      this.emit();
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room || this.connection !== 'connected') return;
    const room = this.room;
    if (enabled) await this.platform.requestMicrophone?.();
    if (this.room !== room || this.connection !== 'connected') return;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    this.emit();
  }

  async startAudio(): Promise<void> {
    if (!this.room) return;
    await this.room.startAudio();
    this.emit();
  }

  async disconnect(): Promise<void> {
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
