import { Module } from '@nestjs/common';

import { SPEECH_TRANSCRIBER } from '../../modules/assistance/contracts.js';
import { OpenAiCompatibleSttAdapter } from './openai-compatible-stt.adapter.js';

@Module({
  providers: [
    OpenAiCompatibleSttAdapter,
    { provide: SPEECH_TRANSCRIBER, useExisting: OpenAiCompatibleSttAdapter },
  ],
  exports: [SPEECH_TRANSCRIBER],
})
export class SttProviderModule {}
