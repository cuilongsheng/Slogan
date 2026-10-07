import { RoomError } from '../../src/modules/rooms/index.js';
import { RoomPolicy } from '../../src/modules/rooms/testing.js';

describe('RoomPolicy', () => {
  const policy = new RoomPolicy();
  const now = new Date('2026-09-11T10:00:00.000Z');

  it.each([
    ['topic', { topic: ' ', cefrLevel: 'B1' as const, capacity: 4 }],
    ['CEFR', { topic: 'Backend practice', cefrLevel: 'Z9' as 'B1', capacity: 4 }],
    ['capacity', { topic: 'Backend practice', cefrLevel: 'B1' as const, capacity: 7 }],
    [
      'password',
      { topic: 'Backend practice', cefrLevel: 'B1' as const, capacity: 4, password: '12a4' },
    ],
  ])('rejects invalid %s configuration', (_field, input) => {
    expect(() => policy.validateCreation(input, now)).toThrow(
      expect.objectContaining({ code: 'ROOM_CONFIGURATION_INVALID' }),
    );
  });

  it('normalizes the topic and assigns an exact two-hour server window', () => {
    expect(
      policy.validateCreation({ topic: '  Backend practice  ', cefrLevel: 'B1', capacity: 4 }, now),
    ).toEqual({
      topic: 'Backend practice',
      cefrLevel: 'B1',
      cefrLevelMin: 'B1',
      cefrLevelMax: 'B1',
      capacity: 4,
      startedAt: now,
      endsAt: new Date('2026-09-11T12:00:00.000Z'),
      visibility: 'PUBLIC',
      sensitiveSpeechDetectionEnabled: false,
      postRoomKeywordsEnabled: false,
    });
  });

  it.each([
    ['PROFILE_REQUIRED', 'PROFILE_REQUIRED'],
    ['AGE_RESTRICTED', 'AGE_RESTRICTED'],
  ] as const)('maps %s eligibility to a stable room error', (state, code) => {
    expect(() => policy.assertEligible(state)).toThrow(expect.objectContaining({ code }));
  });

  it.each([
    ['ended status', { status: 'ENDED' as const }, 'ROOM_ENDED'],
    ['expired room', { endsAt: new Date('2026-09-11T09:59:59.000Z') }, 'ROOM_ENDED'],
    ['rules not accepted', { rulesAccepted: false }, 'ROOM_RULES_NOT_ACCEPTED'],
    [
      'password absent',
      { passwordProtected: true, passwordProvided: false },
      'ROOM_PASSWORD_REQUIRED',
    ],
    [
      'password invalid',
      { passwordProtected: true, passwordProvided: true, passwordValid: false },
      'ROOM_PASSWORD_INVALID',
    ],
    ['full room', { memberCount: 4, capacity: 4 }, 'ROOM_FULL'],
  ])('rejects %s', (_label, override, code) => {
    expect(() =>
      policy.assertCanJoin({
        status: 'OPEN',
        endsAt: new Date('2026-09-11T12:00:00.000Z'),
        now,
        rulesAccepted: true,
        passwordProtected: false,
        passwordProvided: false,
        passwordValid: false,
        memberCount: 1,
        capacity: 4,
        ...override,
      }),
    ).toThrow(expect.objectContaining({ code }));
  });

  it('accepts an eligible user joining an open room with capacity', () => {
    expect(() => policy.assertEligible('ELIGIBLE')).not.toThrow();
    expect(() =>
      policy.assertCanJoin({
        status: 'OPEN',
        endsAt: new Date('2026-09-11T12:00:00.000Z'),
        now,
        rulesAccepted: true,
        passwordProtected: false,
        passwordProvided: false,
        passwordValid: false,
        memberCount: 1,
        capacity: 4,
      }),
    ).not.toThrow();
  });

  it('uses RoomError for stable domain failures', () => {
    expect(() => policy.assertOpen('ENDED', now, now)).toThrow(RoomError);
  });

  it('normalizes discovery filters and binds exact CEFR to a case-insensitive topic', () => {
    expect(policy.normalizeDiscovery({ cefrLevel: 'B1', topic: '  Backend TALK  ' })).toEqual({
      cefrLevel: 'B1',
      topic: 'backend talk',
    });
    expect(() => policy.normalizeDiscovery({ topic: '   ' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
    expect(() => policy.normalizeDiscovery({ cefrLevel: 'Z9' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('allows only the current host to extend an open room up to three times', () => {
    const valid = {
      hostUserId: 'host',
      actorUserId: 'host',
      status: 'OPEN' as const,
      endsAt: new Date(now.getTime() + 60_000),
      now,
      extensionCount: 2,
      additionalMinutes: 60,
    };
    expect(() => policy.assertCanExtend(valid)).not.toThrow();
    expect(() => policy.assertCanExtend({ ...valid, actorUserId: 'member' })).toThrow(
      expect.objectContaining({ code: 'ROOM_HOST_REQUIRED' }),
    );
    expect(() => policy.assertCanExtend({ ...valid, status: 'SCHEDULED' })).toThrow(
      expect.objectContaining({ code: 'ROOM_EXTENSION_NOT_AVAILABLE' }),
    );
    expect(() => policy.assertCanExtend({ ...valid, endsAt: now })).toThrow(
      expect.objectContaining({ code: 'ROOM_EXTENSION_NOT_AVAILABLE' }),
    );
    expect(() => policy.assertCanExtend({ ...valid, extensionCount: 3 })).toThrow(
      expect.objectContaining({ code: 'ROOM_EXTENSION_LIMIT' }),
    );
    for (const additionalMinutes of [0, 61, 1.5])
      expect(() => policy.assertCanExtend({ ...valid, additionalMinutes })).toThrow(
        expect.objectContaining({ code: 'ROOM_CONFIGURATION_INVALID' }),
      );
  });
});
