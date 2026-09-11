import { Module } from '@nestjs/common';

import { StructuredLogger } from './structured-logger.service.js';

@Module({
  providers: [StructuredLogger],
  exports: [StructuredLogger],
})
export class ObservabilityModule {}
