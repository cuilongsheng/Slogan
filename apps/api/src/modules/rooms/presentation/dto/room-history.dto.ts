import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListRoomHistoryQueryDto {
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

export class RoomHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty({ enum: ['INSTANT', 'APPOINTMENT'] })
  kind!: 'INSTANT' | 'APPOINTMENT';

  @ApiProperty()
  topic!: string;

  @ApiProperty({ enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] })
  cefrLevel!: string;

  @ApiProperty({ enum: ['SCHEDULED', 'OPEN', 'ENDING', 'ENDED', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ enum: ['PARTICIPATED', 'RESERVED_ONLY'] })
  relationship!: 'PARTICIPATED' | 'RESERVED_ONLY';

  @ApiProperty({ enum: ['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'], nullable: true })
  membershipLifecycle!: string | null;

  @ApiProperty({ enum: ['HOST', 'MEMBER'], nullable: true })
  membershipRole!: string | null;

  @ApiProperty({
    enum: ['BOOKED', 'CANCELLED', 'CONSUMED', 'EXPIRED'],
    nullable: true,
  })
  reservationStatus!: string | null;

  @ApiProperty()
  noteExists!: boolean;
}

export class RoomHistoryListDto {
  @ApiProperty({ type: [RoomHistoryItemDto] })
  items!: RoomHistoryItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class SaveRoomNoteDto {
  @ApiProperty({ maxLength: 2000, description: 'Whitespace-only content clears the note.' })
  @IsString()
  content!: string;

  @ApiProperty({ minimum: 0, maximum: 2_147_483_646 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  expectedVersion!: number;
}

export class RoomNoteDto {
  @ApiProperty({ type: String, nullable: true })
  content!: string | null;

  @ApiProperty({ minimum: 0 })
  version!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: string | null;
}
