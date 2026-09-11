import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ROOM_CEFR_LEVELS } from '../../domain/entities/room.js';

export class CreateRoomDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  topic!: string;

  @ApiProperty({ enum: ROOM_CEFR_LEVELS })
  @IsIn(ROOM_CEFR_LEVELS)
  cefrLevel!: (typeof ROOM_CEFR_LEVELS)[number];

  @ApiProperty({ minimum: 2, maximum: 6 })
  @IsInt()
  @Min(2)
  @Max(6)
  capacity!: number;

  @ApiPropertyOptional({ pattern: '^\\d{4}$', writeOnly: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  password?: string;
}

export class ListRoomsQueryDto {
  @ApiPropertyOptional({ description: 'Opaque pagination cursor', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class RoomIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;
}

export class JoinRoomDto {
  @ApiProperty({ description: 'Whether the current room rules were actively accepted' })
  @IsBoolean()
  rulesAccepted!: boolean;

  @ApiPropertyOptional({ pattern: '^\\d{4}$', writeOnly: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  password?: string;
}

export class RoomMembershipDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['HOST', 'MEMBER'] })
  role!: 'HOST' | 'MEMBER';

  @ApiProperty({ minimum: 1 })
  joinOrder!: number;

  @ApiProperty()
  rulesVersion!: string;

  @ApiProperty({ format: 'date-time' })
  rulesAcceptedAt!: string;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: string;
}

export class RoomDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  hostUserId!: string;

  @ApiProperty()
  hostDisplayName!: string;

  @ApiProperty()
  topic!: string;

  @ApiProperty({ enum: ROOM_CEFR_LEVELS })
  cefrLevel!: (typeof ROOM_CEFR_LEVELS)[number];

  @ApiProperty({ minimum: 2, maximum: 6 })
  capacity!: number;

  @ApiProperty({ minimum: 1 })
  memberCount!: number;

  @ApiProperty()
  passwordProtected!: boolean;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class RoomDetailDto extends RoomDto {
  @ApiProperty({ type: RoomMembershipDto, nullable: true })
  currentMembership!: RoomMembershipDto | null;
}

export class RoomListDto {
  @ApiProperty({ type: [RoomDto] })
  items!: RoomDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Opaque cursor for the next page' })
  nextCursor!: string | null;
}
