import { RoomNotePolicy } from '../../src/modules/rooms/testing.js';

describe('RoomNotePolicy', () => {
  const policy = new RoomNotePolicy();

  it('preserves non-empty text and normalizes whitespace-only content to a tombstone', () => {
    expect(policy.normalize('  keep my wording\n')).toBe('  keep my wording\n');
    expect(policy.normalize(' \n\t ')).toBeNull();
  });

  it('counts Unicode code points rather than UTF-16 code units', () => {
    expect(policy.normalize('😀'.repeat(2000))).toBe('😀'.repeat(2000));
    expect(() => policy.normalize('😀'.repeat(2001))).toThrow('invalid');
  });

  it.each(['\u0000', '\u0008', '\u000b', '\u001f', '\u007f'])(
    'rejects forbidden control character %j',
    (control) => {
      expect(() => policy.normalize(`note${control}`)).toThrow('invalid');
    },
  );

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid version %s', (version) => {
    expect(() => policy.assertExpectedVersion(version)).toThrow('version');
  });

  it('accepts ENDING and ENDED while rejecting active room states', () => {
    expect(() => policy.assertEnded('ENDING')).not.toThrow();
    expect(() => policy.assertEnded('ENDED')).not.toThrow();
    expect(() => policy.assertEnded('OPEN')).toThrow('after the room ends');
  });
});
