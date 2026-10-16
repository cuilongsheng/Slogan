import { Global, Module } from '@nestjs/common';
import { ObservabilityHeartbeat } from './heartbeat.service.js';
import { ErrorReportingLifecycle } from './error-reporting-lifecycle.service.js';

import { StructuredLogger } from './structured-logger.service.js';

@Global()
@Module({
  providers: [StructuredLogger, ObservabilityHeartbeat, ErrorReportingLifecycle],
  exports: [StructuredLogger, ObservabilityHeartbeat],
})
export class ObservabilityModule {}
