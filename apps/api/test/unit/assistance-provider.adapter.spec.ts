import { ConfigService } from '@nestjs/config';

const jest = import.meta.jest;

import type { Environment } from '../../src/config/environment.js';
import { OpenAiCompatibleExpressionAdapter } from '../../src/infrastructure/ai/openai-compatible-expression.adapter.js';
import { OpenAiCompatibleSttAdapter } from '../../src/infrastructure/stt/openai-compatible-stt.adapter.js';
import { AssistancePolicy } from '../../src/modules/assistance/testing.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('assistance provider adapters', () => {
  const environment = testEnvironment({
    ASSISTANCE_ENABLED: true,
    ASSISTANCE_AUDIO_ENABLED: true,
    REDIS_URL: 'redis://localhost:6379/15',
    AI_EXPRESSION_PROVIDER_CATEGORY: 'TEST_AI',
    AI_EXPRESSION_BASE_URL: 'http://localhost:4444',
    AI_EXPRESSION_API_KEY: 'private-ai-key',
    AI_EXPRESSION_MODEL: 'test-expression',
    AI_EXPRESSION_REGION: 'local',
    AI_EXPRESSION_RETENTION_SECONDS: 0,
    AI_EXPRESSION_NO_TRAINING: true,
    STT_PROVIDER_CATEGORY: 'TEST_STT',
    STT_BASE_URL: 'http://localhost:5555',
    STT_API_KEY: 'private-stt-key',
    STT_MODEL: 'test-stt',
    STT_REGION: 'local',
    STT_RETENTION_SECONDS: 0,
    STT_DELETION_MODE: 'NO_RETENTION',
  });
  const config = new ConfigService<Environment, true>(environment);

  afterEach(() => jest.restoreAllMocks());

  it('sends a scoped idempotent AI request and parses strict output', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  primary: { text: 'May I join you?', tone: 'POLITE' },
                  alternatives: [],
                }),
              },
            },
          ],
          usage: { total_tokens: 23 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const adapter = new OpenAiCompatibleExpressionAdapter(config, new AssistancePolicy());
    await expect(
      adapter.generate({
        requestId: 'request-1',
        text: '我可以加入你们吗',
        topic: 'Travel',
        cefrLevel: 'B1',
      }),
    ).resolves.toMatchObject({
      usageUnits: 23,
      output: { noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE' },
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:4444/v1/chat/completions');
    expect((init?.headers as Record<string, string>)['idempotency-key']).toBe('request-1');
    expect(String(init?.body)).not.toContain('private-ai-key');
  });

  it('normalizes AI HTTP and malformed responses without leaking provider bodies', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const adapter = new OpenAiCompatibleExpressionAdapter(config, new AssistancePolicy());
    fetch.mockResolvedValueOnce(new Response('provider-secret', { status: 503 }));
    await expect(
      adapter.generate({ requestId: 'a', text: 'a', topic: 't', cefrLevel: 'B1' }),
    ).rejects.toMatchObject({
      code: 'ASSISTANCE_PROVIDER_UNAVAILABLE',
      message: 'Expression provider is unavailable',
    });
    fetch.mockResolvedValueOnce(new Response('{"choices":[]}', { status: 200 }));
    await expect(
      adapter.generate({ requestId: 'b', text: 'a', topic: 't', cefrLevel: 'B1' }),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_PROVIDER_RESPONSE_INVALID' });
    fetch.mockRejectedValueOnce(new DOMException('synthetic timeout', 'TimeoutError'));
    await expect(
      adapter.generate({ requestId: 'c', text: 'a', topic: 't', cefrLevel: 'B1' }),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_PROVIDER_TIMEOUT' });
  });

  it('sends only allowed STT multipart fields and parses duration', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: '请再说一次', duration: 1.25 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const adapter = new OpenAiCompatibleSttAdapter(config);
    await expect(
      adapter.transcribe({
        requestId: 'request-2',
        audio: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/wav',
        sourceLanguageCode: 'zh-CN',
      }),
    ).resolves.toEqual({ transcript: '请再说一次', durationMs: 1250, usageUnits: 2 });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:5555/v1/audio/transcriptions');
    const form = init?.body as FormData;
    expect([...form.keys()].sort()).toEqual(['file', 'language', 'model', 'response_format']);
    expect([...form.values()].join(' ')).not.toContain('room');
    expect([...form.values()].join(' ')).not.toContain('user');
  });

  it('normalizes malformed STT responses', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ text: '', duration: 'secret' }), { status: 200 }),
      );
    await expect(
      new OpenAiCompatibleSttAdapter(config).transcribe({
        requestId: 'request-3',
        audio: new Uint8Array([1]),
        mimeType: 'audio/wav',
      }),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_PROVIDER_RESPONSE_INVALID' });
  });
});
