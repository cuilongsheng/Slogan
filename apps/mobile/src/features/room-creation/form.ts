import type { InstantRoomInput, ScheduledRoomInput } from './api';

export type CreateMode = 'instant' | 'scheduled';
export type RoomForm = {
  mode: CreateMode;
  topic: string;
  cefrLevel: NonNullable<InstantRoomInput['cefrLevel']>;
  cefrLevelMin: NonNullable<InstantRoomInput['cefrLevelMin']>;
  cefrLevelMax: NonNullable<InstantRoomInput['cefrLevelMax']>;
  capacity: number;
  visibility: 'PUBLIC' | 'LINK_ONLY';
  passwordEnabled: boolean;
  password: string;
  sensitiveSpeechDetectionEnabled: boolean;
  postRoomKeywordsEnabled: boolean;
  date: string;
  startTime: string;
  endTime: string;
};
export const initialRoomForm: RoomForm = {
  mode: 'instant',
  topic: '',
  cefrLevel: 'B1',
  cefrLevelMin: 'B1',
  cefrLevelMax: 'B2',
  capacity: 4,
  visibility: 'PUBLIC',
  passwordEnabled: false,
  password: '',
  sensitiveSpeechDetectionEnabled: false,
  postRoomKeywordsEnabled: false,
  date: '',
  startTime: '19:00',
  endTime: '20:00',
};
export type ValidationError = 'TOPIC' | 'PASSWORD' | 'DATE' | 'TIME' | 'LEVEL' | null;
export function validateRoomForm(form: RoomForm, now = new Date()): ValidationError {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (levels.indexOf(form.cefrLevelMin) > levels.indexOf(form.cefrLevelMax)) return 'LEVEL';
  const topic = form.topic.trim();
  if ([...topic].length < 2 || [...topic].length > 120) return 'TOPIC';
  if (form.passwordEnabled && !/^\d{4}$/.test(form.password)) return 'PASSWORD';
  if (form.mode === 'scheduled') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return 'DATE';
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.endTime)
    )
      return 'TIME';
    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);
    const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    if (!Number.isFinite(start.getTime()) || localDate !== form.date) return 'DATE';
    if (start.getTime() <= now.getTime() || end.getTime() <= start.getTime()) return 'TIME';
  }
  return null;
}
export function instantInput(form: RoomForm): InstantRoomInput {
  return {
    topic: form.topic.trim(),
    cefrLevel: form.cefrLevelMin,
    cefrLevelMin: form.cefrLevelMin,
    cefrLevelMax: form.cefrLevelMax,
    capacity: form.capacity,
    visibility: form.visibility,
    sensitiveSpeechDetectionEnabled: form.sensitiveSpeechDetectionEnabled,
    postRoomKeywordsEnabled: form.postRoomKeywordsEnabled,
    ...(form.passwordEnabled ? { password: form.password } : {}),
  };
}
export function scheduledInput(form: RoomForm): ScheduledRoomInput {
  const input = instantInput(form);
  return {
    ...input,
    startsAt: new Date(`${form.date}T${form.startTime}:00`).toISOString(),
    endsAt: new Date(`${form.date}T${form.endTime}:00`).toISOString(),
  };
}
