import type { RoomSpeechPurposeContext } from './room-speech-processing.js';

export const ROOM_SPEECH_PROCESSING_REPOSITORY = Symbol('ROOM_SPEECH_PROCESSING_REPOSITORY');

export interface RoomSpeechProcessingRepository {
  activeRooms(input: {
    safetyEnabled: boolean;
    postRoomKeywordsEnabled: boolean;
    now: Date;
  }): Promise<Array<{ id: string; endsAt: Date }>>;
  participant(input: {
    roomId: string;
    participantIdentity: string;
    safetyNoticeVersion: string;
    postRoomKeywordsNoticeVersion: string;
  }): Promise<RoomSpeechPurposeContext | null>;
}
