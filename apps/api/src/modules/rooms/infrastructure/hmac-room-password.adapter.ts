import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../config/environment.js';
import type { RoomPasswordHasher } from '../domain/ports/room-password.port.js';

@Injectable()
export class HmacRoomPasswordAdapter implements RoomPasswordHasher {
  private readonly pepper: string;

  constructor(config: ConfigService<Environment, true>) {
    this.pepper = config.get('ROOM_PASSWORD_PEPPER', { infer: true });
  }

  digest(roomId: string, password: string): string {
    return createHmac('sha256', this.pepper).update(`${roomId}:${password}`).digest('hex');
  }

  matches(roomId: string, password: string, expectedDigest: string): boolean {
    if (!/^[0-9a-f]{64}$/i.test(expectedDigest)) return false;
    const actual = Buffer.from(this.digest(roomId, password), 'hex');
    const expected = Buffer.from(expectedDigest, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
