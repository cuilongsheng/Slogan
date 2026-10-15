import { Room, RoomEvent, Track, DisconnectReason, type RemoteTrack } from 'livekit-client';

import type { RealtimeCredential } from './api';
import { isRoomSafetyAlertSignal } from './safetySignal';
import { reportMobileError } from '../../services/observability';
import { beginVoiceTrace } from '../../services/observability/tracing';

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
}

export class LiveKitVoiceMedia {
  private room: Room | null = null;
  private listeners = new Set<(snapshot: MediaSnapshot) => void>();
  private safetySignalListeners = new Set<() => void>();
  private connection: MediaConnection = 'disconnected';
  private platformStarted = false;
  private finishConnect: ReturnType<typeof beginVoiceTrace> | undefined;
  private finishReconnect: ReturnType<typeof beginVoiceTrace> | undefined;
  private finishQuality: ReturnType<typeof beginVoiceTrace> | undefined;
  private qualityChanges = 0;
  private quality = 'unknown';

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
    const started = Date.now();
    await this.disconnect();
    this.finishConnect = beginVoiceTrace('connect');
    this.qualityChanges = 0;
    this.quality = 'unknown';
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
        if (this.room !== room) return;
        if (!this.finishReconnect) this.finishReconnect = beginVoiceTrace('reconnect');
        this.connection = 'reconnecting';
        this.emit();
      });
      room.on(RoomEvent.Reconnected, () => {
        if (this.room !== room) return;
        this.finishReconnect?.('ok');
        this.finishReconnect = undefined;
        this.connection = 'connected';
        this.emit();
      });
      room.on(RoomEvent.Disconnected, (reason) => {
        if (this.room !== room) return;
        const expected =
          reason === DisconnectReason.CLIENT_INITIATED ||
          reason === DisconnectReason.PARTICIPANT_REMOVED ||
          reason === DisconnectReason.ROOM_DELETED;
        this.finishConnect?.(expected ? 'cancelled' : 'error');
        this.finishConnect = undefined;
        this.finishReconnect?.(expected ? 'cancelled' : 'error');
        this.finishReconnect = undefined;
        this.finishQuality?.('ok');
        this.finishQuality = undefined;
        if (this.room === room && !expected)
          reportMobileError(
            { code: 'VOICE_DISCONNECTED' },
            {
              code:
                this.connection === 'reconnecting'
                  ? 'VOICE_RECONNECT_FAILED'
                  : 'VOICE_DISCONNECTED',
              stage: this.connection === 'reconnecting' ? 'reconnect' : 'connect',
              durationMs: Date.now() - started,
            },
          );
        this.connection = 'disconnected';
        this.emit();
      });
      room.on(RoomEvent.TrackSubscriptionFailed, () => {
        if (this.room === room)
          reportMobileError(
            { code: 'VOICE_TRACK_SUBSCRIPTION_FAILED' },
            { code: 'VOICE_TRACK_SUBSCRIPTION_FAILED', stage: 'subscribe' },
          );
      });
      room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (
          this.room !== room ||
          participant !== room.localParticipant ||
          this.connection === 'disconnected'
        )
          return;
        const value = ['excellent', 'good', 'poor', 'lost'].includes(quality) ? quality : 'unknown';
        if (value === this.quality) return;
        if (this.qualityChanges >= 20) {
          this.finishQuality?.('cancelled');
          this.finishQuality = undefined;
          return;
        }
        this.finishQuality?.('ok');
        this.quality = value;
        this.qualityChanges += 1;
        this.finishQuality = beginVoiceTrace('quality', value);
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
      if (this.room !== room) return;
      this.connection = 'connected';
      this.finishConnect?.('ok');
      this.finishConnect = undefined;
      if (!this.finishQuality) this.finishQuality = beginVoiceTrace('quality', this.quality);
      this.emit();
    } catch (error) {
      this.finishConnect?.('error');
      this.finishConnect = undefined;
      reportMobileError(error, {
        code: 'VOICE_CONNECT_FAILED',
        stage: 'connect',
        durationMs: Date.now() - started,
      });
      await this.disconnect();
      throw error;
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room || this.connection !== 'connected') return;
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    this.emit();
  }

  async startAudio(): Promise<void> {
    if (!this.room) return;
    await this.room.startAudio();
    this.emit();
  }

  async disconnect(): Promise<void> {
    this.finishConnect?.('cancelled');
    this.finishConnect = undefined;
    this.finishReconnect?.('cancelled');
    this.finishReconnect = undefined;
    this.finishQuality?.('ok');
    this.finishQuality = undefined;
    const room = this.room;
    this.room = null;
    room?.removeAllListeners();
    this.connection = 'disconnected';
    if (room) await room.disconnect();
    if (this.platformStarted) {
      this.platformStarted = false;
      await this.platform.stop();
    }
    this.emit();
  }
}
