import { Module } from '@nestjs/common';

import { AssistancePolicy, EXPRESSION_GENERATOR } from '../../modules/assistance/contracts.js';
import { OpenAiCompatibleExpressionAdapter } from './openai-compatible-expression.adapter.js';

@Module({
  providers: [
    AssistancePolicy,
    OpenAiCompatibleExpressionAdapter,
    { provide: EXPRESSION_GENERATOR, useExisting: OpenAiCompatibleExpressionAdapter },
  ],
  exports: [EXPRESSION_GENERATOR],
})
export class AiProviderModule {}
