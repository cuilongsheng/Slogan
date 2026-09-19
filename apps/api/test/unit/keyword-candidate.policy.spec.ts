import { KeywordCandidatePolicy } from '../../src/modules/post-room-learning/index.js';

describe('KeywordCandidatePolicy', () => {
  const policy = new KeywordCandidatePolicy();

  it('normalizes stable English keywords and bounded expressions without member metadata', () => {
    const result = policy.extract('  Practice, PRACTICE! useful travel phrases.  ', 'extractor-v1');

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'KEYWORD',
          normalizedText: 'practice',
          count: 2,
          extractorVersion: 'extractor-v1',
        }),
        expect.objectContaining({ kind: 'EXPRESSION', normalizedText: 'practice practice useful' }),
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(/userId|membership|participant|timeline/);
  });

  it.each([
    'email me at learner@example.com about travel',
    'call me on +86 138 0013 8000 tomorrow',
    'open https://example.com/private for details',
  ])('rejects a complete window containing contact details', (transcript) => {
    expect(policy.extract(transcript, 'extractor-v1')).toEqual([]);
  });

  it('rejects unsafe lengths and produces deterministic ordering', () => {
    expect(policy.extract('x '.repeat(1_100), 'extractor-v1')).toEqual([]);
    expect(policy.extract('Travel useful phrases', 'v1')).toEqual(
      policy.extract('Travel useful phrases', 'v1'),
    );
  });
});
