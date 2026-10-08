import { Inject, Injectable } from '@nestjs/common';
import {
  ROOM_MESSAGE_REPOSITORY,
  type RoomMessageRepository,
} from '../../domain/ports/room-message.repository.js';
import { RoomError } from '../../domain/errors/room.error.js';
@Injectable()
export class RoomMessageService {
  constructor(
    @Inject(ROOM_MESSAGE_REPOSITORY) private readonly repository: RoomMessageRepository,
  ) {}
  send(roomId: string, userId: string, input: { text: string; clientRequestId: string }) {
    const text = input.text.trim();
    if (
      !text ||
      [...text].length > 1000 ||
      [...text].some((character) => {
        const code = character.codePointAt(0)!;
        return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
      })
    )
      throw new RoomError(
        'VALIDATION_FAILED',
        'Message must contain 1 to 1000 plain text characters',
      );
    return this.repository.send({ roomId, userId, clientRequestId: input.clientRequestId, text });
  }
  async list(roomId: string, userId: string, input: { cursor?: string; limit?: number }) {
    let after: string | null = null;
    if (input.cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) as {
          roomId: unknown;
          sequence: unknown;
        };
        if (
          parsed.roomId !== roomId ||
          typeof parsed.sequence !== 'string' ||
          !/^\d{1,19}$/.test(parsed.sequence) ||
          BigInt(parsed.sequence) > 9223372036854775807n
        )
          throw new Error();
        after = parsed.sequence;
      } catch {
        throw new RoomError('VALIDATION_FAILED', 'Invalid message cursor');
      }
    }
    const page = await this.repository.list({ roomId, userId, after, limit: input.limit ?? 50 });
    const sequence = page.items.at(-1)?.sequence ?? after ?? '0';
    return {
      ...page,
      nextCursor: Buffer.from(JSON.stringify({ roomId, sequence })).toString('base64url'),
    };
  }
}
