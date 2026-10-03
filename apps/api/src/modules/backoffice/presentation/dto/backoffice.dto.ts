import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BACKOFFICE_ACTIONS,
  BACKOFFICE_ROLES,
  type BackofficeAction,
  type BackofficeAuditResult,
  type BackofficeRole,
} from '../../domain/entities/backoffice.js';

export class BackofficeUserParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() userId!: string;
}
export class BackofficeRoleParamsDto extends BackofficeUserParamsDto {
  @ApiProperty({ enum: BACKOFFICE_ROLES }) @IsIn(BACKOFFICE_ROLES) role!: BackofficeRole;
}
export class RoleMutationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  reason!: string;
}
export class BackofficeMeDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: BACKOFFICE_ROLES, isArray: true }) roles!: BackofficeRole[];
}
export class RoleAssignmentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: BACKOFFICE_ROLES }) role!: BackofficeRole;
  @ApiProperty() active!: boolean;
  @ApiProperty({ format: 'date-time' }) grantedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) revokedAt!: string | null;
  @ApiProperty({ minimum: 1 }) version!: number;
}
export class ListRoleAssignmentsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ enum: BACKOFFICE_ROLES })
  @IsOptional()
  @IsIn(BACKOFFICE_ROLES)
  role?: BackofficeRole;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  active?: boolean;
  @ApiPropertyOptional({ maxLength: 500 })
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
export class RoleAssignmentListDto {
  @ApiProperty({ type: [RoleAssignmentDto] }) items!: RoleAssignmentDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class AuditEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['USER', 'SYSTEM_BOOTSTRAP', 'SYSTEM_JOB'] })
  actorType!: 'USER' | 'SYSTEM_BOOTSTRAP' | 'SYSTEM_JOB';
  @ApiProperty({ format: 'uuid', nullable: true }) actorUserId!: string | null;
  @ApiProperty({ enum: BACKOFFICE_ROLES, isArray: true }) actorRoles!: BackofficeRole[];
  @ApiProperty({ enum: BACKOFFICE_ACTIONS }) action!: BackofficeAction;
  @ApiProperty() targetType!: string;
  @ApiProperty({ nullable: true }) targetId!: string | null;
  @ApiProperty({ enum: BACKOFFICE_ROLES, nullable: true }) role!: BackofficeRole | null;
  @ApiProperty({ nullable: true }) reason!: string | null;
  @ApiProperty({ enum: ['SUCCEEDED', 'REJECTED'] }) result!: BackofficeAuditResult;
  @ApiProperty({ nullable: true }) requestId!: string | null;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
}
export class ListAuditEventsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() actorUserId?: string;
  @ApiPropertyOptional({ enum: BACKOFFICE_ACTIONS })
  @IsOptional()
  @IsIn(BACKOFFICE_ACTIONS)
  action?: BackofficeAction;
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetType?: string;
  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetId?: string;
  @ApiPropertyOptional({ enum: ['SUCCEEDED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['SUCCEEDED', 'REJECTED'])
  result?: BackofficeAuditResult;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ maxLength: 500 })
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
export class AuditEventListDto {
  @ApiProperty({ type: [AuditEventDto] }) items!: AuditEventDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
