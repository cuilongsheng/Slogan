export const ROOM_MEDIA_SOURCE = Symbol('ROOM_MEDIA_SOURCE');

export interface RoomMediaFrame {
  participantIdentity: string;
  audio: Uint8Array;
  mimeType: 'audio/pcm';
}

export interface RoomMediaSession {
  close(): Promise<void>;
}

export interface RoomMediaSource {
  healthCheck(): Promise<void>;
  connect(input: {
    roomId: string;
    onFrame(frame: RoomMediaFrame): void;
    onParticipantInactive(participantIdentity: string): void;
    onFailure(errorCategory: string): void;
  }): Promise<RoomMediaSession>;
}
