import { initialRoomForm, instantInput, scheduledInput, validateRoomForm } from './form';

describe('room creation input', () => {
  const now = new Date('2026-09-28T08:00:00.000Z');
  it('requires a topic and a four digit password when enabled', () => {
    expect(validateRoomForm(initialRoomForm, now)).toBe('TOPIC');
    expect(
      validateRoomForm(
        { ...initialRoomForm, topic: 'Travel', passwordEnabled: true, password: '123' },
        now,
      ),
    ).toBe('PASSWORD');
    expect(
      validateRoomForm(
        { ...initialRoomForm, topic: ' Travel ', passwordEnabled: true, password: '1234' },
        now,
      ),
    ).toBeNull();
    expect(
      instantInput({
        ...initialRoomForm,
        topic: ' Travel ',
        passwordEnabled: true,
        password: '1234',
        visibility: 'LINK_ONLY',
      }),
    ).toMatchObject({ topic: 'Travel', visibility: 'LINK_ONLY', password: '1234', sensitiveSpeechDetectionEnabled: false, postRoomKeywordsEnabled: false });
    expect(instantInput({ ...initialRoomForm, topic: 'Travel', postRoomKeywordsEnabled: true }).postRoomKeywordsEnabled).toBe(true);
  });
  it('checks the actual calendar date and appointment order', () => {
    const form = {
      ...initialRoomForm,
      topic: 'Travel',
      mode: 'scheduled' as const,
      date: '2026-09-29',
      startTime: '19:00',
      endTime: '20:00',
    };
    expect(validateRoomForm(form, now)).toBeNull();
    expect(scheduledInput(form).startsAt).toContain('T');
    expect(validateRoomForm({ ...form, date: '2026-02-30' }, now)).toBe('DATE');
    expect(validateRoomForm({ ...form, endTime: '18:00' }, now)).toBe('TIME');
    expect(validateRoomForm({ ...form, date: '2026-09-27' }, now)).toBe('TIME');
  });
});
