export const ROOM_SPEECH_TRANSCRIBER = Symbol('ROOM_SPEECH_TRANSCRIBER');

export interface RoomSpeechTranscriptionSession {
  transcribeWindow(input: {
    requestId: string;
    audio: Uint8Array;
    mimeType: string;
    sourceLanguageCode?: string;
  }): Promise<{ transcript: string; durationMs: number; usageUnits: number }>;
  close(): Promise<void>;
}

export interface RoomSpeechTranscriber {
  readonly category: string;
  healthCheck(): Promise<void>;
  deletionAssurance(): Promise<{
    mode: 'NO_RETENTION' | 'DELETE_AFTER_PROCESSING';
    result: 'COMPLETED' | 'UNCERTAIN';
    reasonCode?: string;
  }>;
  openSession(input: { anonymousSessionId: string }): Promise<RoomSpeechTranscriptionSession>;
}
