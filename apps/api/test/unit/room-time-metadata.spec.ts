import { serializeRoomTimeMetadata } from '../../src/modules/voice/index.js';

describe('room time metadata', () => {
  it('serializes a stable versioned UTC whitelist', () => {
    const value = serializeRoomTimeMetadata({
      stateVersion: 7,
      endsAt: new Date('2026-09-15T12:34:56.789Z'),
      extensionCount: 2,
    });
    expect(value).toBe(
      '{"schemaVersion":1,"stateVersion":7,"endsAt":"2026-09-15T12:34:56.789Z","extensionCount":2}',
    );
    expect(Object.keys(JSON.parse(value))).toEqual([
      'schemaVersion',
      'stateVersion',
      'endsAt',
      'extensionCount',
    ]);
  });
});
