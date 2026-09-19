import type { SpeechParticipantContext } from '../../speech-safety/index.js';

export interface RoomSpeechPurposeContext {
  roomId: string;
  participantIdentity: string;
  roomEndsAt: Date;
  safety: SpeechParticipantContext | null;
  postRoomKeywordsConsentGeneration: string | null;
}
