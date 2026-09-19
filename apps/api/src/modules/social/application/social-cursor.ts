import type { SocialCursor } from '../domain/entities/social.js';
import { SocialError } from '../domain/errors/social.error.js';

export function encodeSocialCursor(kind: string, cursor: SocialCursor): string {
  return Buffer.from(
    JSON.stringify({ v: 1, kind, createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
  ).toString('base64url');
}

export function decodeSocialCursor(kind: string, cursor?: string): SocialCursor | null {
  if (cursor === undefined) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      parsed.v !== 1 ||
      parsed.kind !== kind ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)
    )
      throw new Error('invalid');
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== parsed.createdAt)
      throw new Error('invalid');
    return { createdAt, id: parsed.id };
  } catch {
    throw new SocialError('SOCIAL_CURSOR_INVALID', 'Social cursor is invalid');
  }
}
