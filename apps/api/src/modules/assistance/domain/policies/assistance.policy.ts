import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  ASSISTANCE_TONES,
  type ExpressionOutput,
  type ExpressionStatus,
} from '../entities/assistance.js';
import { AssistanceError } from '../errors/assistance.error.js';

const allowedMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
]);

@Injectable()
export class AssistancePolicy {
  normalizeText(value: string): string {
    const normalized = value.trim();
    const length = [...normalized].length;
    if (length < 1 || length > 1000)
      throw new AssistanceError('ASSISTANCE_REQUEST_FAILED', 'Expression text is invalid');
    return normalized;
  }

  assertAudio(audio: { buffer: Uint8Array; mimeType: string }): void {
    if (
      audio.buffer.byteLength < 1 ||
      audio.buffer.byteLength > 5 * 1024 * 1024 ||
      !allowedMimeTypes.has(audio.mimeType)
    )
      throw new AssistanceError('ASSISTANCE_AUDIO_INVALID', 'Audio input is invalid');
  }

  digest(input: { roomId: string; mode: 'TEXT' | 'AUDIO'; value: string | Uint8Array }): string {
    const hash = createHash('sha256');
    hash.update(input.roomId);
    hash.update('\0');
    hash.update(input.mode);
    hash.update('\0');
    hash.update(input.value);
    return hash.digest('hex');
  }

  validateOutput(value: unknown): ExpressionOutput {
    if (!value || typeof value !== 'object') return this.invalidOutput();
    const item = value as Record<string, unknown>;
    const primary = this.expression(item.primary);
    if (!primary || !Array.isArray(item.alternatives) || item.alternatives.length > 2)
      return this.invalidOutput();
    const alternatives = item.alternatives.map((entry) => this.expression(entry));
    if (alternatives.some((entry) => entry === null)) return this.invalidOutput();
    return {
      primary,
      alternatives: alternatives as ExpressionOutput['alternatives'],
      noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE',
    };
  }

  assertTransition(from: ExpressionStatus, to: ExpressionStatus): void {
    const transitions: Record<ExpressionStatus, ExpressionStatus[]> = {
      RESERVED: ['STT_RUNNING', 'AI_RUNNING', 'FAILED'],
      STT_RUNNING: ['AI_RUNNING', 'FAILED', 'UNCERTAIN'],
      AI_RUNNING: ['SUCCEEDED', 'FAILED', 'UNCERTAIN'],
      SUCCEEDED: [],
      FAILED: [],
      UNCERTAIN: ['STT_RUNNING', 'AI_RUNNING', 'FAILED'],
    };
    if (!transitions[from].includes(to))
      throw new AssistanceError('ASSISTANCE_REQUEST_CONFLICT', 'Request state is invalid');
  }

  private expression(value: unknown): ExpressionOutput['primary'] | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.text !== 'string' ||
      [...item.text.trim()].length < 1 ||
      [...item.text.trim()].length > 300 ||
      typeof item.tone !== 'string' ||
      !ASSISTANCE_TONES.includes(item.tone as (typeof ASSISTANCE_TONES)[number])
    )
      return null;
    return { text: item.text.trim(), tone: item.tone as ExpressionOutput['primary']['tone'] };
  }

  private invalidOutput(): never {
    throw new AssistanceError(
      'ASSISTANCE_PROVIDER_RESPONSE_INVALID',
      'Expression provider returned an invalid response',
    );
  }
}
