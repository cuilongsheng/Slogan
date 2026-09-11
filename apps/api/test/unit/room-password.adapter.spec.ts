import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config/environment.js';
import { HmacRoomPasswordAdapter } from '../../src/modules/rooms/testing.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('HmacRoomPasswordAdapter', () => {
  const adapter = new HmacRoomPasswordAdapter(
    new ConfigService<Environment, true>(testEnvironment()),
  );
  const roomId = '1a3624d0-3e30-4ae4-b9e7-c8f821893e41';

  it('creates a deterministic 64-character room-scoped digest', () => {
    const digest = adapter.digest(roomId, '1234');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(adapter.digest(roomId, '1234')).toBe(digest);
    expect(adapter.digest('c7f33e47-82b7-47ce-9a90-c40ef6fa310f', '1234')).not.toBe(digest);
    expect(digest).not.toContain('1234');
  });

  it('matches only the correct room and PIN and safely rejects malformed digests', () => {
    const digest = adapter.digest(roomId, '1234');
    expect(adapter.matches(roomId, '1234', digest)).toBe(true);
    expect(adapter.matches(roomId, '0000', digest)).toBe(false);
    expect(adapter.matches('c7f33e47-82b7-47ce-9a90-c40ef6fa310f', '1234', digest)).toBe(false);
    expect(adapter.matches(roomId, '1234', 'not-a-digest')).toBe(false);
  });
});
