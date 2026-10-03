import { remainingMinutes, roomAvailability } from './presentation';
import type { RoomSummary } from './api';

const base: RoomSummary = {
  id: 'room-a',
  hostUserId: 'host-a',
  hostDisplayName: 'Host',
  visibility: 'PUBLIC',
  topic: 'Travel',
  cefrLevel: 'B1',
  capacity: 6,
  memberCount: 2,
  hostReconnectDeadline: null,
  passwordProtected: false,
  startedAt: '2026-09-25T00:00:00.000Z',
  endsAt: '2026-09-25T01:00:00.000Z',
  sensitiveSpeechDetectionEnabled: true,
  postRoomKeywordsEnabled: false,
};

describe('room availability', () => {
  const now = Date.parse('2026-09-25T00:30:00.000Z');
  it('distinguishes available, full, reconnecting and ended states', () => {
    expect(roomAvailability(base, now)).toBe('available');
    expect(roomAvailability({ ...base, memberCount: 6 }, now)).toBe('full');
    expect(
      roomAvailability({ ...base, hostReconnectDeadline: '2026-09-25T00:40:00.000Z' }, now),
    ).toBe('reconnecting');
    expect(roomAvailability(base, Date.parse('2026-09-25T01:00:00.000Z'))).toBe('ended');
  });
  it('rounds remaining minutes up without returning negative values', () => {
    expect(remainingMinutes(base.endsAt, now + 1)).toBe(30);
    expect(remainingMinutes(base.endsAt, now + 60 * 60_000)).toBe(0);
  });
});
