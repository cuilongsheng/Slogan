import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

import { LOG_REDACTION } from './log-redaction.js';

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly logger: Logger = pino({
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: LOG_REDACTION,
  });

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, this.toMessage(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, this.toMessage(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, this.toMessage(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, this.toMessage(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, this.toMessage(message));
  }

  private toMessage(message: unknown): string {
    return typeof message === 'string' ? message : JSON.stringify(message);
  }
}
