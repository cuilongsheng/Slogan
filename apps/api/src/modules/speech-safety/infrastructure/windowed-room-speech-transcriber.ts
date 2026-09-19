import { Inject, Injectable } from '@nestjs/common';
import { SPEECH_TRANSCRIBER, type SpeechTranscriber } from '../../assistance/contracts.js';
import type {
  RoomSpeechTranscriber,
  RoomSpeechTranscriptionSession,
} from '../domain/ports/room-speech-transcriber.port.js';

@Injectable()
export class WindowedRoomSpeechTranscriber implements RoomSpeechTranscriber {
  constructor(@Inject(SPEECH_TRANSCRIBER) private readonly provider: SpeechTranscriber) {}

  get category() {
    return this.provider.category;
  }

  healthCheck() {
    return this.provider.healthCheck();
  }

  async openSession(_input: {
    anonymousSessionId: string;
  }): Promise<RoomSpeechTranscriptionSession> {
    const controller = new AbortController();
    let closed = false;
    return {
      transcribeWindow: async (input) => {
        if (closed) throw new Error('ROOM_SPEECH_SESSION_CLOSED');
        return this.provider.transcribe({ ...input, signal: controller.signal });
      },
      close: async () => {
        if (closed) return;
        closed = true;
        controller.abort();
      },
    };
  }
}
