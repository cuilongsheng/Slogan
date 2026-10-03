export const SPEECH_TRANSCRIBER = Symbol('SPEECH_TRANSCRIBER');

export type SpeechDeletionAssurance = {
  mode: 'NO_RETENTION' | 'DELETE_AFTER_PROCESSING';
  result: 'COMPLETED' | 'UNCERTAIN';
  reasonCode?: string;
};

export interface SpeechTranscriber {
  readonly category: string;
  healthCheck(): Promise<void>;
  deletionAssurance(): Promise<SpeechDeletionAssurance>;
  transcribe(input: {
    requestId: string;
    audio: Uint8Array;
    mimeType: string;
    sourceLanguageCode?: string;
    signal?: AbortSignal;
  }): Promise<{ transcript: string; durationMs: number; usageUnits: number }>;
}
