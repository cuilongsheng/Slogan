import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, METRIC_DIMENSIONS, METRIC_GRAINS, METRIC_KEYS, RETENTION_CATEGORIES, type IncidentSeverity, type IncidentStatus, type MetricDimension, type MetricGrain, type MetricKey, type RetentionCategory } from '../../domain/entities/operations.js';

export class OperationsPageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
export class TimeRangeQueryDto extends OperationsPageQueryDto {
  @ApiProperty({ format: 'date-time' }) @IsDateString() from!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() to!: string;
}
export class MetricsQueryDto extends TimeRangeQueryDto {
  @ApiPropertyOptional({ enum: METRIC_GRAINS }) @IsOptional() @IsIn(METRIC_GRAINS) grain?: MetricGrain;
  @ApiPropertyOptional({ enum: METRIC_KEYS }) @IsOptional() @IsIn(METRIC_KEYS) metricKey?: MetricKey;
  @ApiPropertyOptional({ enum: METRIC_DIMENSIONS }) @IsOptional() @IsIn(METRIC_DIMENSIONS) dimension?: MetricDimension;
}
export class GenerateMetricDto {
  @ApiProperty({ enum: METRIC_GRAINS }) @IsIn(METRIC_GRAINS) grain!: MetricGrain;
  @ApiProperty({ format: 'date-time' }) @IsDateString() windowInstant!: string;
}
export class IncidentQueryDto extends OperationsPageQueryDto {
  @ApiPropertyOptional({ enum: INCIDENT_STATUSES }) @IsOptional() @IsIn(INCIDENT_STATUSES) status?: IncidentStatus;
  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES }) @IsOptional() @IsIn(INCIDENT_SEVERITIES) severity?: IncidentSeverity;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) component?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
}
export class IdParamsDto { @ApiProperty({ format: 'uuid' }) @IsUUID() id!: string; }
export class IncidentCommandDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
}
export class CreatePolicyDto {
  @ApiProperty({ enum: RETENTION_CATEGORIES }) @IsIn(RETENTION_CATEGORIES) category!: RetentionCategory;
  @ApiProperty({ maxLength: 128 }) @IsString() @MaxLength(128) scopeKey!: string;
  @ApiProperty({ minimum: 0, maximum: 31536000 }) @IsInt() @Min(0) @Max(31_536_000) retentionSeconds!: number;
  @ApiProperty({ maxLength: 256 }) @IsString() @MaxLength(256) rationaleRef!: string;
  @ApiProperty() @IsBoolean() automatic!: boolean;
}
export class ReasonDto { @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string; }
export class DryRunDto { @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string; }
export class CreateHoldDto extends ReasonDto {
  @ApiProperty({ enum: RETENTION_CATEGORIES }) @IsIn(RETENTION_CATEGORIES) category!: RetentionCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) targetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) targetId?: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() startsAt!: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() endsAt?: string;
}
export class CreateRunDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ enum: ['DELETE APPROVED RETENTION CANDIDATES'] }) @IsIn(['DELETE APPROVED RETENTION CANDIDATES']) confirmation!: string;
}
export class RecoveryDrillDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ enum: ['LOCAL', 'TARGET'] }) @IsIn(['LOCAL', 'TARGET']) environment!: 'LOCAL' | 'TARGET';
  @ApiProperty() @IsString() @MaxLength(64) environmentId!: string;
  @ApiProperty() @IsString() @Length(64, 64) backupDigest!: string;
  @ApiProperty() @IsString() @MaxLength(64) toolVersion!: string;
  @ApiProperty() @IsString() @MaxLength(128) schemaVersion!: string;
  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED'] }) @IsIn(['SUCCEEDED', 'FAILED']) status!: 'SUCCEEDED' | 'FAILED';
  @ApiProperty() @IsInt() @Min(0) observedRpoSeconds!: number;
  @ApiProperty() @IsInt() @Min(0) observedRtoSeconds!: number;
  @ApiProperty() @IsObject() checkSummary!: Record<string, string | number | boolean>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) errorCode?: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() startedAt!: string;
  @ApiProperty({ format: 'date-time' }) @IsDateString() completedAt!: string;
}
