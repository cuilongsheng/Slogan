import type { ReportCategory } from './report.js';

export const REPORT_PROGRESS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type ReportProgress = (typeof REPORT_PROGRESS)[number];
export interface ReportHistoryCursor {
  submittedAt: Date;
  id: string;
}
export interface PersonalReport {
  id: string;
  caseId: string | null;
  kind: 'ROOM' | 'ROOM_MEMBER' | 'DIRECT_MESSAGE';
  roomTopic: string | null;
  category: ReportCategory;
  status: ReportProgress;
  submittedAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
}
