export const METRIC_KEYS = [
  'PROFILE_COMPLETION_RATE',
  'FIRST_ROOM_ACTION_RATE',
  'FIRST_VOICE_CONNECTION_RATE',
  'FIVE_MINUTE_CONVERSATION_RATE',
  'AVERAGE_EFFECTIVE_ROOM_SECONDS',
  'AI_CONTINUATION_RATE',
  'POST_ROOM_SAVE_RATE',
  'SEVEN_DAY_RETURN_RATE',
  'SHARE_JOIN_CONVERSION_RATE',
  'APPOINTMENT_ATTENDANCE_RATE',
  'SAFETY_CASE_RESOLUTION_SECONDS',
  'REPEAT_REMOVED_OR_REPORTED_USERS',
  'HOST_REPORT_COMPLETION_RATE',
  'DISMISSED_REPORT_RATE',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const METRIC_GRAINS = ['DAY', 'WEEK'] as const;
export type MetricGrain = (typeof METRIC_GRAINS)[number];
export const METRIC_DIMENSIONS = ['NATIONALITY', 'CEFR', 'ROOM_TYPE', 'RESULT'] as const;
export type MetricDimension = (typeof METRIC_DIMENSIONS)[number];
export type MetricStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

export interface MetricWindow {
  grain: MetricGrain;
  start: Date;
  end: Date;
}

export interface MetricFact {
  metricKey: MetricKey;
  dimensions: Record<string, string>;
  status: MetricStatus;
  value: number | null;
  numerator: bigint | null;
  denominator: bigint | null;
  sampleSize: number;
  reasonCode?: string;
}

export interface MetricSnapshotView extends MetricFact {
  id: string;
  grain: MetricGrain;
  windowStart: Date;
  windowEnd: Date;
  definitionVersion: string;
  dataThroughAt: Date;
  generatedAt: Date;
  suppressed: boolean;
}

export interface MetricSnapshotQuery {
  from: Date;
  to: Date;
  grain?: MetricGrain;
  metricKey?: MetricKey;
  dimension?: MetricDimension;
  cursor?: string;
  limit: number;
}

export interface RoomOperationsQuery {
  scope?: 'CURRENT';
  cursor?: string;
  limit: number;
  q?: string;
  status?: import('../../../rooms/index.js').RoomStatus;
  visibility?: import('../../../rooms/index.js').RoomVisibility;
  from?: Date;
}

export const INCIDENT_SEVERITIES = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export const INCIDENT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IncidentObservationInput {
  component: string;
  category: string;
  severity: IncidentSeverity;
  scopeType: string;
  scopeKey: string;
  ruleVersion: string;
  reasonCode: string;
  observedAt: Date;
}

export interface IncidentView extends IncidentObservationInput {
  id: string;
  occurrence: number;
  status: IncidentStatus;
  observationCount: number;
  firstObservedAt: Date;
  lastObservedAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  acknowledgeReason: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionReason: string | null;
}

export interface IncidentQuery {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  component?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

export const RETENTION_CATEGORIES = [
  'TEMPORARY_SPEECH_CONTENT',
  'SHORT_TERM_AI_OUTPUT',
  'TEMPORARY_COORDINATION',
  'TECHNICAL_COMMAND',
  'OPERATIONS_METRIC',
  'ACCOUNT_IDENTITY',
  'USER_PRIVATE_CONTENT',
  'SAFETY_EVIDENCE',
  'ENFORCEMENT_APPEAL',
  'BACKOFFICE_AUDIT',
] as const;
export type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];
export type RetentionPolicyStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
export type RetentionRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface RetentionPolicyView {
  id: string;
  category: RetentionCategory;
  scopeKey: string;
  version: number;
  retentionSeconds: number | null;
  rationaleRef: string;
  automatic: boolean;
  status: RetentionPolicyStatus;
  createdByUserId: string;
  createdAt: Date;
  activatedAt: Date | null;
}

export interface RetentionDryRunView {
  id: string;
  policyId: string;
  category: RetentionCategory;
  impact: 'PHYSICAL_DELETE_OR_PURGE';
  boundaryEligibleAt: Date;
  candidateCount: number;
  earliestEligibleAt: Date | null;
  latestEligibleAt: Date | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface RetentionHoldView {
  id: string;
  category: RetentionCategory;
  targetType: string | null;
  targetId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  reason: string;
  createdAt: Date;
  releasedAt: Date | null;
}

export interface RetentionRunView {
  id: string;
  policyId: string;
  dryRunId: string;
  category: RetentionCategory;
  policyVersion: number;
  boundaryEligibleAt: Date;
  status: RetentionRunStatus;
  generation: number;
  scannedCount: number;
  deletedCount: number;
  skippedCount: number;
  failedCount: number;
  errorCode: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface DeletionEvidenceView {
  id: string;
  category: RetentionCategory;
  purpose: string;
  providerCategory: string | null;
  policyVersion: string;
  deadlineAt: Date;
  completedAt: Date | null;
  result: 'COMPLETED' | 'UNCERTAIN' | 'FAILED';
  reasonCode: string | null;
  createdAt: Date;
}

export interface GovernancePageQuery {
  cursor?: string;
  limit: number;
}

export interface GovernancePage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface RecoveryDrillView {
  id: string;
  environment: 'LOCAL' | 'TARGET';
  environmentId: string;
  backupDigest: string;
  toolVersion: string;
  schemaVersion: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  observedRpoSeconds: number | null;
  observedRtoSeconds: number | null;
  checkSummary: Record<string, string | number | boolean>;
  errorCode: string | null;
  startedAt: Date;
  completedAt: Date | null;
}
