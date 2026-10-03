import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/environment.js';
import { AssistanceError, type SpeechTranscriber } from '../../modules/assistance/contracts.js';

@Injectable()
export class OpenAiCompatibleSttAdapter implements SpeechTranscriber {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  get category(): string {
    return this.config.get('STT_PROVIDER_CATEGORY', { infer: true }) ?? 'DISABLED';
  }

  async healthCheck(): Promise<void> {
    if (
      !this.config.get('ASSISTANCE_AUDIO_ENABLED', { infer: true }) &&
      !this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true })
    )
      throw new AssistanceError('ASSISTANCE_UNAVAILABLE', 'Speech provider is unavailable');
    try {
      const response = await fetch(
        new URL(
          `/v1/models/${encodeURIComponent(this.config.get('STT_MODEL', { infer: true })!)}`,
          this.trailing(this.config.get('STT_BASE_URL', { infer: true })!),
        ),
        {
          headers: {
            authorization: `Bearer ${this.config.get('STT_API_KEY', { infer: true })!}`,
          },
          signal: AbortSignal.timeout(this.config.get('STT_TIMEOUT_MS', { infer: true })),
        },
      );
      if (!response.ok) throw new Error('provider readiness failed');
    } catch {
      throw new AssistanceError(
        'ASSISTANCE_PROVIDER_UNAVAILABLE',
        'Speech provider is unavailable',
      );
    }
  }

  async deletionAssurance() {
    const mode = this.config.get('STT_DELETION_MODE', { infer: true })!;
    return mode === 'NO_RETENTION'
      ? { mode, result: 'COMPLETED' as const }
      : {
          mode,
          result: 'UNCERTAIN' as const,
          reasonCode: 'PROVIDER_DELETION_UNCONFIRMED',
        };
  }

  async transcribe(input: Parameters<SpeechTranscriber['transcribe']>[0]) {
    if (
      !this.config.get('ASSISTANCE_AUDIO_ENABLED', { infer: true }) &&
      !this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true })
    )
      throw new AssistanceError('ASSISTANCE_UNAVAILABLE', 'Audio assistance is unavailable');
    const form = new FormData();
    form.set('model', this.config.get('STT_MODEL', { infer: true })!);
    form.set('response_format', 'verbose_json');
    if (input.sourceLanguageCode) form.set('language', input.sourceLanguageCode);
    form.set(
      'file',
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      `audio-${input.requestId}`,
    );
    let response: Response;
    try {
      response = await fetch(
        new URL(
          '/v1/audio/transcriptions',
          this.trailing(this.config.get('STT_BASE_URL', { infer: true })!),
        ),
        {
          method: 'POST',
          signal: input.signal
            ? AbortSignal.any([
                input.signal,
                AbortSignal.timeout(this.config.get('STT_TIMEOUT_MS', { infer: true })),
              ])
            : AbortSignal.timeout(this.config.get('STT_TIMEOUT_MS', { infer: true })),
          headers: {
            authorization: `Bearer ${this.config.get('STT_API_KEY', { infer: true })!}`,
            'idempotency-key': input.requestId,
          },
          body: form,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError')
        throw new AssistanceError('ASSISTANCE_PROVIDER_TIMEOUT', 'Speech provider timed out');
      throw new AssistanceError(
        'ASSISTANCE_PROVIDER_UNAVAILABLE',
        'Speech provider is unavailable',
      );
    }
    if (!response.ok)
      throw new AssistanceError(
        'ASSISTANCE_PROVIDER_UNAVAILABLE',
        'Speech provider is unavailable',
      );
    try {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body.text !== 'string' || !body.text.trim()) throw new Error('text');
      const duration = Number(body.duration);
      if (!Number.isFinite(duration) || duration < 0) throw new Error('duration');
      return {
        transcript: body.text.trim(),
        durationMs: Math.ceil(duration * 1000),
        usageUnits: Math.ceil(duration),
      };
    } catch {
      throw new AssistanceError(
        'ASSISTANCE_PROVIDER_RESPONSE_INVALID',
        'Speech provider returned an invalid response',
      );
    }
  }

  private trailing(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
  }
}
