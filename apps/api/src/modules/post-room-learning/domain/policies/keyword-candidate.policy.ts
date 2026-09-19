import type {
  AnonymousKeywordCandidate,
  RoomKeywordItemKind,
} from '../entities/post-room-learning.js';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'he',
  'her',
  'his',
  'i',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'she',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'we',
  'were',
  'with',
  'you',
  'your',
]);
const CONTACT = /(?:https?:\/\/|www\.|\b\S+@\S+\.\S+\b|(?:\+?\d[\d\s().-]{6,}\d))/iu;
const TOKEN = /^[\p{L}][\p{L}\p{M}'-]{1,39}$/u;

export class KeywordCandidatePolicy {
  extract(transcript: string, extractorVersion: string): AnonymousKeywordCandidate[] {
    if (!transcript || transcript.length > 2_000 || CONTACT.test(transcript)) return [];
    const words = transcript
      .normalize('NFKC')
      .toLocaleLowerCase('en-US')
      .replace(/[^\p{L}\p{M}'-]+/gu, ' ')
      .trim()
      .split(/\s+/u)
      .filter((word) => TOKEN.test(word) && !STOP_WORDS.has(word));
    const counts = new Map<string, AnonymousKeywordCandidate>();
    for (const word of words) this.add(counts, 'KEYWORD', word, extractorVersion);
    for (let index = 0; index + 1 < words.length; index += 1) {
      const size = index + 2 < words.length ? 3 : 2;
      const phrase = words.slice(index, index + size).join(' ');
      if (phrase.length >= 5 && phrase.length <= 80)
        this.add(counts, 'EXPRESSION', phrase, extractorVersion);
    }
    return [...counts.values()].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.normalizedText.localeCompare(right.normalizedText),
    );
  }

  normalizePersonal(value: string): { displayText: string; normalizedText: string } {
    const displayText = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
    const normalizedText = displayText.toLocaleLowerCase('en-US');
    if (!displayText || displayText.length > 120 || CONTACT.test(displayText))
      throw new Error('INVALID_VOCABULARY_TEXT');
    return { displayText, normalizedText };
  }

  safeCandidate(kind: RoomKeywordItemKind, text: string): boolean {
    if (CONTACT.test(text) || text.length < 2 || text.length > (kind === 'KEYWORD' ? 40 : 80))
      return false;
    const tokens = text.split(/\s+/u);
    return (
      tokens.length <= (kind === 'KEYWORD' ? 1 : 3) && tokens.every((token) => TOKEN.test(token))
    );
  }

  private add(
    values: Map<string, AnonymousKeywordCandidate>,
    kind: RoomKeywordItemKind,
    text: string,
    extractorVersion: string,
  ) {
    if (!this.safeCandidate(kind, text)) return;
    const key = `${kind}:${text}`;
    const current = values.get(key);
    if (current) current.count += 1;
    else
      values.set(key, {
        kind,
        normalizedText: text,
        displayText: text,
        count: 1,
        extractorVersion,
      });
  }
}
