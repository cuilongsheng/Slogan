import { AssistancePolicy } from '../../src/modules/assistance/testing.js';

describe('AssistancePolicy', () => {
  const policy = new AssistancePolicy();

  it('normalizes text and enforces Unicode scalar length boundaries', () => {
    expect(policy.normalizeText('  你好  ')).toBe('你好');
    expect(() => policy.normalizeText('')).toThrow(
      expect.objectContaining({ code: 'ASSISTANCE_REQUEST_FAILED' }),
    );
    expect(() => policy.normalizeText('a'.repeat(1001))).toThrow(
      expect.objectContaining({ code: 'ASSISTANCE_REQUEST_FAILED' }),
    );
  });

  it('accepts only one bounded supported audio payload', () => {
    expect(() =>
      policy.assertAudio({ buffer: new Uint8Array([1]), mimeType: 'audio/wav' }),
    ).not.toThrow();
    for (const audio of [
      { buffer: new Uint8Array(), mimeType: 'audio/wav' },
      { buffer: new Uint8Array([1]), mimeType: 'application/octet-stream' },
      { buffer: new Uint8Array(5 * 1024 * 1024 + 1), mimeType: 'audio/wav' },
    ])
      expect(() => policy.assertAudio(audio)).toThrow(
        expect.objectContaining({ code: 'ASSISTANCE_AUDIO_INVALID' }),
      );
  });

  it('binds digests to room, mode and content without exposing input', () => {
    const value = policy.digest({ roomId: 'room-1', mode: 'TEXT', value: 'secret phrase' });
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(value).not.toContain('secret');
    expect(policy.digest({ roomId: 'room-2', mode: 'TEXT', value: 'secret phrase' })).not.toBe(
      value,
    );
    expect(policy.digest({ roomId: 'room-1', mode: 'AUDIO', value: 'secret phrase' })).not.toBe(
      value,
    );
  });

  it('validates bounded structured output and all legal state transitions', () => {
    expect(
      policy.validateOutput({
        primary: { text: 'Could you say that again?', tone: 'POLITE' },
        alternatives: [{ text: 'One more time, please.', tone: 'CASUAL' }],
      }),
    ).toMatchObject({ noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE' });
    expect(() =>
      policy.validateOutput({
        primary: { text: 'bad', tone: 'UNSAFE' },
        alternatives: [],
      }),
    ).toThrow(expect.objectContaining({ code: 'ASSISTANCE_PROVIDER_RESPONSE_INVALID' }));
    expect(() => policy.assertTransition('RESERVED', 'AI_RUNNING')).not.toThrow();
    expect(() => policy.assertTransition('SUCCEEDED', 'AI_RUNNING')).toThrow(
      expect.objectContaining({ code: 'ASSISTANCE_REQUEST_CONFLICT' }),
    );
  });
});
