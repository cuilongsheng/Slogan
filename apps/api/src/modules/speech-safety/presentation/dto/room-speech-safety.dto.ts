import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ROOM_SPEECH_RISK_CATEGORIES,
  ROOM_SPEECH_RISK_SEVERITIES,
  SAFETY_CAPABILITY_COMPONENTS,
} from '../../domain/entities/room-speech-safety.js';

export class RoomSafetyAlertParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;
}

export class CursorPageQueryDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class RoomSpeechAlertDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ format: 'uuid' }) subjectUserId!: string;
  @ApiProperty({ enum: ROOM_SPEECH_RISK_CATEGORIES }) category!: string;
  @ApiProperty({ enum: ROOM_SPEECH_RISK_SEVERITIES }) severity!: string;
  @ApiProperty() ruleSetVersion!: string;
  @ApiProperty({ format: 'date-time' }) firstOccurredAt!: string;
  @ApiProperty({ format: 'date-time' }) lastOccurredAt!: string;
  @ApiProperty({ minimum: 1 }) occurrenceCount!: number;
  @ApiProperty({ enum: ['REQUIRES_HUMAN_REVIEW'] }) noticeCode!: string;
}

export class RoomSpeechAlertPageDto {
  @ApiProperty({ type: [RoomSpeechAlertDto] }) items!: RoomSpeechAlertDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class SafetyCapabilityIncidentQueryDto extends CursorPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ enum: SAFETY_CAPABILITY_COMPONENTS })
  @IsOptional()
  @IsIn(SAFETY_CAPABILITY_COMPONENTS)
  component?: (typeof SAFETY_CAPABILITY_COMPONENTS)[number];

  @ApiPropertyOptional({ enum: ['OPEN', 'RECOVERED'] })
  @IsOptional()
  @IsIn(['OPEN', 'RECOVERED'])
  status?: 'OPEN' | 'RECOVERED';

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export class SafetyCapabilityIncidentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) roomId!: string | null;
  @ApiProperty({ enum: SAFETY_CAPABILITY_COMPONENTS }) component!: string;
  @ApiProperty() errorCategory!: string;
  @ApiProperty({ type: String, nullable: true }) providerCategory!: string | null;
  @ApiProperty({ enum: ['OPEN', 'RECOVERED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) lastObservedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) recoveredAt!: string | null;
  @ApiProperty({ minimum: 1 }) affectedWindows!: number;
}

export class SafetyCapabilityIncidentPageDto {
  @ApiProperty({ type: [SafetyCapabilityIncidentDto] }) items!: SafetyCapabilityIncidentDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
