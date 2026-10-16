import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../../common/errors/app-error.js';

type Position = { mode: 'before' | 'after'; sequence: number; anchor: number };
export function timelineCursor(secret: string, actor: string, conversation: string) {
  const sign = (body: string) =>
    createHmac('sha256', secret).update(`timeline-v1:${body}`).digest('base64url');
  return {
    encode(position: Position) {
      const body = Buffer.from(JSON.stringify({ actor, conversation, ...position })).toString(
        'base64url',
      );
      return `${body}.${sign(body)}`;
    },
    decode(value: string, mode: Position['mode']): Position {
      try {
        if (value.length > 1000 || !/^[-\w]+\.[-\w]{43}$/.test(value)) throw new Error();
        const [body, signature] = value.split('.');
        if (
          !body ||
          !signature ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(body)))
        )
          throw new Error();
        const position = JSON.parse(Buffer.from(body, 'base64url').toString()) as Position & {
          actor: string;
          conversation: string;
        };
        if (
          position.actor !== actor ||
          position.conversation !== conversation ||
          position.mode !== mode ||
          ![position.sequence, position.anchor].every(
            (n) => Number.isSafeInteger(n) && n >= 0 && n < 2147483647,
          ) ||
          position.sequence > position.anchor
        )
          throw new Error();
        return position;
      } catch {
        throw new AppError('DIRECT_CURSOR_INVALID', 'Invalid timeline cursor', 400);
      }
    },
  };
}
