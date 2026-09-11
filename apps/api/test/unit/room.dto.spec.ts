import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateRoomDto,
  JoinRoomDto,
  ListRoomsQueryDto,
  RoomIdParamsDto,
} from '../../src/modules/rooms/testing.js';

describe('room transport DTOs', () => {
  it.each([
    { topic: 'x', cefrLevel: 'B1', capacity: 4 },
    { topic: 'Valid topic', cefrLevel: 'Z9', capacity: 4 },
    { topic: 'Valid topic', cefrLevel: 'B1', capacity: 1 },
    { topic: 'Valid topic', cefrLevel: 'B1', capacity: 4, password: '12a4' },
  ])('rejects invalid room creation payload %#', async (payload) => {
    expect(await validate(plainToInstance(CreateRoomDto, payload))).not.toHaveLength(0);
  });

  it('accepts valid room creation and transforms list limits', async () => {
    expect(
      await validate(
        plainToInstance(CreateRoomDto, {
          topic: 'Valid topic',
          cefrLevel: 'B1',
          capacity: 6,
          password: '1234',
        }),
      ),
    ).toHaveLength(0);
    const query = plainToInstance(ListRoomsQueryDto, { limit: '50' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.limit).toBe(50);
    expect(await validate(plainToInstance(ListRoomsQueryDto, { limit: 51 }))).not.toHaveLength(0);
  });

  it('requires a UUID room id and a boolean rules decision', async () => {
    expect(
      await validate(plainToInstance(RoomIdParamsDto, { roomId: 'not-uuid' })),
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(JoinRoomDto, { rulesAccepted: 'true' })),
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(JoinRoomDto, { rulesAccepted: false, password: '1234' })),
    ).toHaveLength(0);
  });
});
