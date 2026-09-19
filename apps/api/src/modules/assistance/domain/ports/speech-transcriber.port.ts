export const SPEECH_TRANSCRIBER = Symbol('SPEECH_TRANSCRIBER');

export interface SpeechTranscriber {
  readonly category: string;
  healthCheck(): Promise<void>;
  transcribe(input: {
    requestId: string;
    audio: Uint8Array;
    mimeType: string;
    sourceLanguageCode?: string;
    signal?: AbortSignal;
  }): Promise<{ transcript: string; durationMs: number; usageUnits: number }>;
}
