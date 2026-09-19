export const SAFETY_CASE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type SafetyCaseStatus = (typeof SAFETY_CASE_STATUSES)[number];
export const SAFETY_SEVERITIES = ['GENERAL', 'SERIOUS', 'HIGH_RISK'] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];
export const SAFETY_RESOLUTIONS = [
  'NO_ACTION',
  'TEMPORARY_RESTRICTION',
  'PERMANENT_DISABLE',
] as const;
export type SafetyResolution = (typeof SAFETY_RESOLUTIONS)[number];
export const SAFETY_APPEAL_DECISIONS = ['UPHELD', 'LIFTED'] as const;
export type SafetyAppealDecision = (typeof SAFETY_APPEAL_DECISIONS)[number];
export type SafetyAppealStatus = 'PENDING' | SafetyAppealDecision;

export interface SafetyActor {
  userId: string;
  roles: Array<'PLATFORM_ADMIN' | 'SAFETY_OFFICER' | 'OPERATIONS_ANALYST' | 'AUDITOR'>;
  requestId?: string;
}

export interface SafetyCaseView {
  id: string;
  reportId: string;
  roomId: string;
  targetUserId: string;
  category: string;
  status: SafetyCaseStatus;
  assigneeUserId: string | null;
  assignedAt: Date | null;
  reviewStartedAt: Date | null;
  assessedSeverity: SafetySeverity | null;
  decisionType: string | null;
  decisionReason: string | null;
  decidedAt: Date | null;
  version: number;
  createdAt: Date;
}

export interface SafetyRestrictionView {
  id: string;
  caseId: string;
  userId: string;
  kind: 'TEMPORARY' | 'PERMANENT';
  severity: SafetySeverity;
  status: 'ACTIVE' | 'EXPIRED' | 'LIFTED';
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
  appealDeadlineAt: Date | null;
  liftedAt: Date | null;
  expiredAt: Date | null;
  version: number;
  appealStatus: SafetyAppealStatus | null;
}

export interface SafetyAppealView {
  id: string;
  restrictionId: string;
  userId: string;
  status: SafetyAppealStatus;
  reason: string;
  submittedAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
}

export interface SafetyCaseQuery {
  status?: SafetyCaseStatus;
  targetUserId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

export interface SafetyCommandInput {
  actor: SafetyActor;
  caseId: string;
  clientRequestId: string;
  reason?: string;
}

export interface SafetyResolveInput extends SafetyCommandInput {
  resolution: SafetyResolution;
  severity?: SafetySeverity;
  factsConfirmed?: boolean;
}
