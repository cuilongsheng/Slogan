import { Type } from 'class-transformer';
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
  SAFETY_APPEAL_DECISIONS,
  SAFETY_CASE_STATUSES,
  SAFETY_RESOLUTIONS,
  SAFETY_SEVERITIES,
  type SafetyAppealDecision,
  type SafetyCaseStatus,
  type SafetyResolution,
  type SafetySeverity,
} from '../../domain/entities/safety.js';

export class SafetyCaseParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() caseId!: string;
}
export class SafetyRestrictionParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() restrictionId!: string;
}
export class SafetyAppealParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() appealId!: string;
}

export class SafetyCommandDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
}
export class SafetyReasonCommandDto extends SafetyCommandDto {
  @ApiProperty({ minLength: 1, maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
}
export class SubmitSafetyAppealDto extends SafetyCommandDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MaxLength(2000) reason!: string;
}
export class ResolveSafetyCaseDto extends SafetyReasonCommandDto {
  @ApiProperty({ enum: SAFETY_RESOLUTIONS })
  @IsIn(SAFETY_RESOLUTIONS)
  resolution!: SafetyResolution;
  @ApiPropertyOptional({ enum: SAFETY_SEVERITIES })
  @IsOptional()
  @IsIn(SAFETY_SEVERITIES)
  severity?: SafetySeverity;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() factsConfirmed?: boolean;
}
export class DecideSafetyAppealDto extends SafetyReasonCommandDto {
  @ApiProperty({ enum: SAFETY_APPEAL_DECISIONS })
  @IsIn(SAFETY_APPEAL_DECISIONS)
  decision!: SafetyAppealDecision;
}

export class PageQueryDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
export class SafetyCaseListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SAFETY_CASE_STATUSES })
  @IsOptional()
  @IsIn(SAFETY_CASE_STATUSES)
  status?: SafetyCaseStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() targetUserId?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() to?: string;
}
export class SafetyRestrictionListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() userId?: string;
}
export class SafetyAppealListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'UPHELD', 'LIFTED'] })
  @IsOptional()
  @IsIn(['PENDING', 'UPHELD', 'LIFTED'])
  status?: string;
}

export class SafetyCaseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ format: 'uuid' }) targetUserId!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: SAFETY_CASE_STATUSES }) status!: SafetyCaseStatus;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) assigneeUserId!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) assignedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) reviewStartedAt!:
    string | null;
  @ApiProperty({ enum: SAFETY_SEVERITIES, nullable: true })
  assessedSeverity!: SafetySeverity | null;
  @ApiProperty({
    type: String,
    enum: [...SAFETY_RESOLUTIONS, 'DISMISSED'],
    nullable: true,
  })
  decisionType!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionReason!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt!: string | null;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class SafetyCaseListDto {
  @ApiProperty({ type: [SafetyCaseDto] }) items!: SafetyCaseDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class SafetyCaseSummaryDto {
  @ApiProperty({ minimum: 0 }) open!: number;
  @ApiProperty({ minimum: 0 }) highRisk!: number;
  @ApiProperty({ minimum: 0 }) closed!: number;
}
export class SafetyRestrictionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) caseId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: ['TEMPORARY', 'PERMANENT'] }) kind!: string;
  @ApiProperty({ enum: SAFETY_SEVERITIES }) severity!: SafetySeverity;
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED', 'LIFTED'] }) status!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endsAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  appealDeadlineAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) liftedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) expiredAt!: string | null;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ enum: ['PENDING', 'UPHELD', 'LIFTED'], nullable: true }) appealStatus!:
    string | null;
}
export class SafetyRestrictionListDto {
  @ApiProperty({ type: [SafetyRestrictionDto] }) items!: SafetyRestrictionDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class OwnSafetyRestrictionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: SAFETY_SEVERITIES }) severity!: SafetySeverity;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED', 'LIFTED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) appealDeadlineAt!: string;
  @ApiProperty({ enum: ['PENDING', 'UPHELD', 'LIFTED'], nullable: true }) appealStatus!:
    string | null;
}
export class OwnSafetyRestrictionListDto {
  @ApiProperty({ type: [OwnSafetyRestrictionDto] }) items!: OwnSafetyRestrictionDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class SafetyAppealDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) restrictionId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: ['PENDING', 'UPHELD', 'LIFTED'] }) status!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  decidedByUserId!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionReason!: string | null;
}
export class SafetyAppealListDto {
  @ApiProperty({ type: [SafetyAppealDto] }) items!: SafetyAppealDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class SafetyAppealSummaryDto {
  @ApiProperty({ minimum: 0 }) pending!: number;
  @ApiProperty({ minimum: 0 }) upheld!: number;
  @ApiProperty({ minimum: 0 }) lifted!: number;
}
export class SafetyResolveResultDto {
  @ApiProperty({ type: SafetyCaseDto }) case!: SafetyCaseDto;
  @ApiProperty({ type: SafetyRestrictionDto, nullable: true })
  restriction!: SafetyRestrictionDto | null;
}
class SafetyEvidenceReportDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ format: 'uuid' }) reporterUserId!: string;
  @ApiProperty({ format: 'uuid' }) targetUserId!: string;
  @ApiProperty({
    enum: [
      'HARASSMENT_ABUSE',
      'HATE_DISCRIMINATION',
      'SEXUAL_CONTENT',
      'SPAM_ADVERTISING',
      'OTHER',
    ],
  })
  category!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
}
class SafetyEvidenceParticipantDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: ['HOST', 'MEMBER'] }) role!: string;
  @ApiProperty({ enum: ['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'] }) lifecycle!: string;
  @ApiProperty({ format: 'date-time' }) joinedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) leftAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) removedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) capturedAt!: string;
}
class SafetyEvidenceRoomEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() source!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) actorId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) targetId!: string | null;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty() result!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
}
class SafetyEvidenceRelatedReportDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
}
class SafetyEvidenceRelatedCaseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: SAFETY_CASE_STATUSES }) status!: string;
  @ApiProperty({ type: String, enum: SAFETY_SEVERITIES, nullable: true }) assessedSeverity!:
    string | null;
  @ApiProperty({
    type: String,
    enum: [...SAFETY_RESOLUTIONS, 'DISMISSED'],
    nullable: true,
  })
  decisionType!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
class SafetyEvidenceRestrictionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['TEMPORARY', 'PERMANENT'] }) kind!: string;
  @ApiProperty({ enum: SAFETY_SEVERITIES }) severity!: string;
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED', 'LIFTED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) endsAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) liftedAt!: string | null;
}
class SafetyEvidenceActivityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    enum: [
      'CREATED',
      'UNASSIGNED',
      'ASSIGNED',
      'REASSIGNED',
      'CLAIMED',
      'REVIEW_STARTED',
      'RESOLVED',
      'DISMISSED',
      'RESTRICTION_EXPIRED',
      'RESTRICTION_LIFTED',
      'APPEAL_SUBMITTED',
      'APPEAL_UPHELD',
      'APPEAL_LIFTED',
    ],
  })
  type!: string;
  @ApiProperty({ enum: ['USER', 'SYSTEM_JOB'] }) actorType!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) actorUserId!: string | null;
  @ApiProperty({ type: String, enum: SAFETY_CASE_STATUSES, nullable: true }) fromStatus!:
    string | null;
  @ApiProperty({ type: String, enum: SAFETY_CASE_STATUSES, nullable: true }) toStatus!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) assigneeUserId!: string | null;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
}
class SafetyEvidenceRoomEventPageDto {
  @ApiProperty({ type: [SafetyEvidenceRoomEventDto] }) items!: SafetyEvidenceRoomEventDto[];
  @ApiProperty() truncated!: boolean;
}
class SafetyEvidenceRelatedReportPageDto {
  @ApiProperty({ type: [SafetyEvidenceRelatedReportDto] }) items!: SafetyEvidenceRelatedReportDto[];
  @ApiProperty() truncated!: boolean;
}
class SafetyEvidenceRelatedCasePageDto {
  @ApiProperty({ type: [SafetyEvidenceRelatedCaseDto] }) items!: SafetyEvidenceRelatedCaseDto[];
  @ApiProperty() truncated!: boolean;
}
class SafetyEvidenceRestrictionPageDto {
  @ApiProperty({ type: [SafetyEvidenceRestrictionDto] }) items!: SafetyEvidenceRestrictionDto[];
  @ApiProperty() truncated!: boolean;
}
class SafetyEvidenceSpeechRiskDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) subjectUserId!: string;
  @ApiProperty() category!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() ruleSetVersion!: string;
  @ApiProperty({ format: 'date-time' }) firstOccurredAt!: string;
  @ApiProperty({ format: 'date-time' }) lastOccurredAt!: string;
  @ApiProperty({ minimum: 1 }) occurrenceCount!: number;
}
class SafetyEvidenceSpeechIncidentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() component!: string;
  @ApiProperty() errorCategory!: string;
  @ApiProperty({ enum: ['OPEN', 'RECOVERED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) lastObservedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) recoveredAt!: string | null;
}
class SafetyEvidenceSpeechRiskPageDto {
  @ApiProperty({ type: [SafetyEvidenceSpeechRiskDto] }) items!: SafetyEvidenceSpeechRiskDto[];
  @ApiProperty() truncated!: boolean;
}
class SafetyEvidenceSpeechIncidentPageDto {
  @ApiProperty({ type: [SafetyEvidenceSpeechIncidentDto] })
  items!: SafetyEvidenceSpeechIncidentDto[];
  @ApiProperty() truncated!: boolean;
}
class SafetyEvidenceSpeechSignalsDto {
  @ApiProperty({ enum: ['NOT_ENABLED', 'AVAILABLE', 'DEGRADED'] }) availability!: string;
  @ApiProperty({ type: SafetyEvidenceSpeechRiskPageDto })
  riskEvents!: SafetyEvidenceSpeechRiskPageDto;
  @ApiProperty({ type: SafetyEvidenceSpeechIncidentPageDto })
  capabilityIncidents!: SafetyEvidenceSpeechIncidentPageDto;
}
export class SafetyEvidenceDto {
  @ApiProperty({ format: 'uuid' }) caseId!: string;
  @ApiProperty({ type: SafetyEvidenceReportDto }) report!: SafetyEvidenceReportDto;
  @ApiProperty({ type: [SafetyEvidenceParticipantDto] })
  participants!: SafetyEvidenceParticipantDto[];
  @ApiProperty({ type: SafetyEvidenceRoomEventPageDto })
  roomEvents!: SafetyEvidenceRoomEventPageDto;
  @ApiProperty({ type: SafetyEvidenceRelatedReportPageDto })
  relatedReports!: SafetyEvidenceRelatedReportPageDto;
  @ApiProperty({ type: SafetyEvidenceRelatedCasePageDto })
  relatedCases!: SafetyEvidenceRelatedCasePageDto;
  @ApiProperty({ type: SafetyEvidenceRestrictionPageDto })
  restrictions!: SafetyEvidenceRestrictionPageDto;
  @ApiProperty({ type: [SafetyEvidenceActivityDto] }) activities!: SafetyEvidenceActivityDto[];
  @ApiProperty({ type: SafetyEvidenceSpeechSignalsDto })
  speechSignals!: SafetyEvidenceSpeechSignalsDto;
}
