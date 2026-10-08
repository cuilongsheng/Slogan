import { ROOM_CEFR_LEVELS, type RoomCefrLevel } from '../entities/room.js';
import { RoomError } from '../errors/room.error.js';
export function roomLevelRange(input: {
  cefrLevel?: string;
  cefrLevelMin?: string | null;
  cefrLevelMax?: string | null;
}) {
  const legacy = input.cefrLevel?.split('_');
  const min = input.cefrLevelMin ?? legacy?.[0];
  const max = input.cefrLevelMax ?? legacy?.at(-1);
  if (
    !min ||
    !max ||
    !ROOM_CEFR_LEVELS.includes(min as RoomCefrLevel) ||
    !ROOM_CEFR_LEVELS.includes(max as RoomCefrLevel) ||
    ROOM_CEFR_LEVELS.indexOf(min as RoomCefrLevel) > ROOM_CEFR_LEVELS.indexOf(max as RoomCefrLevel)
  )
    throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Room level range is invalid');
  return { cefrLevelMin: min as RoomCefrLevel, cefrLevelMax: max as RoomCefrLevel };
}
