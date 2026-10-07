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

import { ROOM_CEFR_LEVELS, ROOM_VISIBILITIES } from '../../domain/entities/room.js';

export class CreateRoomDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  topic!: string;

  @ApiPropertyOptional({ enum: ROOM_CEFR_LEVELS })
  @IsOptional()
  @IsIn(ROOM_CEFR_LEVELS)
  cefrLevel?: (typeof ROOM_CEFR_LEVELS)[number];

  @ApiPropertyOptional({ enum: ROOM_CEFR_LEVELS })
  @IsOptional()
  @IsIn(ROOM_CEFR_LEVELS)
  cefrLevelMin?: (typeof ROOM_CEFR_LEVELS)[number];

  @ApiPropertyOptional({ enum: ROOM_CEFR_LEVELS })
  @IsOptional()
  @IsIn(ROOM_CEFR_LEVELS)
  cefrLevelMax?: (typeof ROOM_CEFR_LEVELS)[number];

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

  @ApiPropertyOptional({ enum: ROOM_VISIBILITIES, default: 'PUBLIC' })
  @IsOptional()
  @IsIn(ROOM_VISIBILITIES)
  visibility?: (typeof ROOM_VISIBILITIES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  sensitiveSpeechDetectionEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  postRoomKeywordsEnabled?: boolean;
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

  @ApiPropertyOptional({ enum: ROOM_CEFR_LEVELS })
  @IsOptional()
  @IsIn(ROOM_CEFR_LEVELS)
  cefrLevel?: (typeof ROOM_CEFR_LEVELS)[number];

  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  invitationId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Anonymous attribution returned by the share-link resolve endpoint.',
  })
  @IsOptional()
  @IsUUID()
  shareAttributionId?: string;
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

  @ApiProperty({ enum: ['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'] })
  lifecycle!: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'INVITED';

  @ApiProperty({ minimum: 0 })
  credentialVersion!: number;

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

  @ApiProperty({ enum: ROOM_VISIBILITIES })
  visibility!: (typeof ROOM_VISIBILITIES)[number];

  @ApiProperty()
  topic!: string;

  @ApiProperty({ enum: ROOM_CEFR_LEVELS })
  cefrLevel!: (typeof ROOM_CEFR_LEVELS)[number];
  @ApiProperty({ enum: ROOM_CEFR_LEVELS }) cefrLevelMin!: (typeof ROOM_CEFR_LEVELS)[number];
  @ApiProperty({ enum: ROOM_CEFR_LEVELS }) cefrLevelMax!: (typeof ROOM_CEFR_LEVELS)[number];

  @ApiProperty({ minimum: 2, maximum: 6 })
  capacity!: number;

  @ApiProperty({ minimum: 0 })
  memberCount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'New memberships are paused until this host window is settled.',
  })
  hostReconnectDeadline!: string | null;

  @ApiProperty()
  passwordProtected!: boolean;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty()
  sensitiveSpeechDetectionEnabled!: boolean;

  @ApiProperty()
  postRoomKeywordsEnabled!: boolean;
}

export class RoomDetailDto extends RoomDto {
  @ApiProperty({ type: RoomMembershipDto, nullable: true })
  currentMembership!: RoomMembershipDto | null;

  @ApiProperty({ format: 'uri' })
  shareUrl!: string;
}

export class RoomShareParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  shareCode!: string;
}

export class RoomShareQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  attributionId?: string;
}

export class RoomShareDto {
  @ApiProperty({ format: 'uuid' }) attributionId!: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['INSTANT', 'APPOINTMENT'] }) kind!: 'INSTANT' | 'APPOINTMENT';
  @ApiProperty({ enum: ['SCHEDULED', 'OPEN'] }) status!: string;
  @ApiProperty({ enum: ROOM_VISIBILITIES }) visibility!: (typeof ROOM_VISIBILITIES)[number];
  @ApiProperty() topic!: string;
  @ApiProperty({ enum: ROOM_CEFR_LEVELS }) cefrLevel!: (typeof ROOM_CEFR_LEVELS)[number];
  @ApiProperty({ minimum: 2, maximum: 6 }) capacity!: number;
  @ApiProperty({ minimum: 0 }) memberCount!: number;
  @ApiProperty({ minimum: 0 }) reservedCount!: number;
  @ApiProperty({ minimum: 0 }) availableCount!: number;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() hostDisplayName!: string;
  @ApiProperty() passwordProtected!: boolean;
  @ApiProperty() sensitiveSpeechDetectionEnabled!: boolean;
  @ApiProperty() postRoomKeywordsEnabled!: boolean;
}

export class RoomListDto {
  @ApiProperty({ type: [RoomDto] })
  items!: RoomDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Opaque cursor for the next page' })
  nextCursor!: string | null;
}
