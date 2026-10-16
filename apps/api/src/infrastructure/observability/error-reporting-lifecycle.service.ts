import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { flushErrors } from './error-reporting.js';

@Injectable()
export class ErrorReportingLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await flushErrors();
  }
}
