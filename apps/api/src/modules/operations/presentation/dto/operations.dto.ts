import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  METRIC_DIMENSIONS,
  METRIC_GRAINS,
  METRIC_KEYS,
  RETENTION_CATEGORIES,
  type IncidentSeverity,
  type IncidentStatus,
  type MetricDimension,
  type MetricGrain,
  type MetricKey,
  type RetentionCategory,
} from '../../domain/entities/operations.js';

export class OperationsPageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
const ROOM_OPERATION_STATUSES = ['SCHEDULED', 'CANCELLED', 'OPEN', 'ENDING', 'ENDED'] as const;
const ROOM_OPERATION_VISIBILITIES = ['PUBLIC', 'LINK_ONLY'] as const;
export class OperationsRoomQueryDto extends OperationsPageQueryDto {
  @ApiPropertyOptional({ enum: ['CURRENT'] }) @IsOptional() @IsIn(['CURRENT']) scope?: 'CURRENT';
  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional({ enum: ROOM_OPERATION_STATUSES })
  @IsOptional()
  @IsIn(ROOM_OPERATION_STATUSES)
  status?: (typeof ROOM_OPERATION_STATUSES)[number];
  @ApiPropertyOptional({ enum: ROOM_OPERATION_VISIBILITIES })
  @IsOptional()
  @IsIn(ROOM_OPERATION_VISIBILITIES)
  visibility?: (typeof ROOM_OPERATION_VISIBILITIES)[number];
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
}
export class OperationsRoomCountsDto {
  @ApiProperty() memberships!: number;
  @ApiProperty() reservations!: number;
  @ApiProperty() reports!: number;
}
export class OperationsRoomDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() topic!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() visibility!: string;
  @ApiProperty() status!: string;
  @ApiProperty() cefrLevel!: string;
  @ApiProperty({ type: String, nullable: true }) cefrLevelMin!: string | null;
  @ApiProperty({ type: String, nullable: true }) cefrLevelMax!: string | null;
  @ApiProperty() capacity!: number;
  @ApiProperty({ format: 'date-time' }) startedAt!: Date;
  @ApiProperty({ format: 'date-time' }) endsAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endedAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: OperationsRoomCountsDto }) _count!: OperationsRoomCountsDto;
}
export class OperationsRoomPageDto {
  @ApiProperty({ type: [OperationsRoomDto] }) items!: OperationsRoomDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class TimeRangeQueryDto extends OperationsPageQueryDto {
  @ApiProperty({ format: 'date-time' }) @IsDateString() from!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() to!: string;
}
export class MetricsQueryDto extends TimeRangeQueryDto {
  @ApiPropertyOptional({ enum: METRIC_GRAINS })
  @IsOptional()
  @IsIn(METRIC_GRAINS)
  grain?: MetricGrain;
  @ApiPropertyOptional({ enum: METRIC_KEYS })
  @IsOptional()
  @IsIn(METRIC_KEYS)
  metricKey?: MetricKey;
  @ApiPropertyOptional({ enum: METRIC_DIMENSIONS })
  @IsOptional()
  @IsIn(METRIC_DIMENSIONS)
  dimension?: MetricDimension;
}
export class GenerateMetricDto {
  @ApiProperty({ enum: METRIC_GRAINS }) @IsIn(METRIC_GRAINS) grain!: MetricGrain;
  @ApiProperty({ format: 'date-time' }) @IsDateString() windowInstant!: string;
}
export class IncidentQueryDto extends OperationsPageQueryDto {
  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: IncidentStatus;
  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: IncidentSeverity;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) component?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
}
export class IdParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id!: string;
}
export class IncidentCommandDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ minLength: 1, maxLength: 500 }) @IsString() @Length(1, 500) reason!: string;
}
export class CreatePolicyDto {
  @ApiProperty({ enum: RETENTION_CATEGORIES })
  @IsIn(RETENTION_CATEGORIES)
  category!: RetentionCategory;
  @ApiProperty({ minLength: 1, maxLength: 128 }) @IsString() @Length(1, 128) scopeKey!: string;
  @ApiProperty({ minimum: 0, maximum: 31536000 })
  @IsInt()
  @Min(0)
  @Max(31_536_000)
  retentionSeconds!: number;
  @ApiProperty({ minLength: 1, maxLength: 256 })
  @IsString()
  @Length(1, 256)
  rationaleRef!: string;
  @ApiProperty() @IsBoolean() automatic!: boolean;
}
export class ReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 500 }) @IsString() @Length(1, 500) reason!: string;
}
export class DryRunDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
}
export class CreateHoldDto extends ReasonDto {
  @ApiProperty({ enum: RETENTION_CATEGORIES })
  @IsIn(RETENTION_CATEGORIES)
  category!: RetentionCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) targetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) targetId?: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() startsAt!: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() endsAt?: string;
}
export class CreateRunDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ enum: ['DELETE APPROVED RETENTION CANDIDATES'] })
  @IsIn(['DELETE APPROVED RETENTION CANDIDATES'])
  confirmation!: string;
}
export class RecoveryDrillDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ enum: ['LOCAL', 'TARGET'] }) @IsIn(['LOCAL', 'TARGET']) environment!:
    'LOCAL' | 'TARGET';
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/) environmentId!: string;
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/i) backupDigest!: string;
  @ApiProperty() @IsString() @MaxLength(64) toolVersion!: string;
  @ApiProperty() @IsString() @MaxLength(128) schemaVersion!: string;
  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED'] }) @IsIn(['SUCCEEDED', 'FAILED']) status!:
    'SUCCEEDED' | 'FAILED';
  @ApiProperty() @IsInt() @Min(0) observedRpoSeconds!: number;
  @ApiProperty() @IsInt() @Min(0) observedRtoSeconds!: number;
  @ApiProperty() @IsObject() checkSummary!: Record<string, string | number | boolean>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) errorCode?: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() startedAt!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() completedAt!: string;
}
