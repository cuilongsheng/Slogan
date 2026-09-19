export const REPORT_CATEGORIES = [
  'HARASSMENT_ABUSE',
  'HATE_DISCRIMINATION',
  'SEXUAL_CONTENT',
  'SPAM_ADVERTISING',
  'OTHER',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export interface ReportInput {
  roomId: string;
  reporterUserId: string;
  targetUserId: string;
  clientRequestId: string;
  category: ReportCategory;
  description: string;
}
export interface ReportReceipt {
  id: string;
  caseId: string;
  submittedAt: Date;
}
export interface ReportRecord extends ReportInput {
  id: string;
  submittedAt: Date;
  safetyCase: { id: string } | null;
}
export interface ReportContext {
  roomId: string;
  reporter: { userId: string; joinedAt: Date | null } | null;
  target: { userId: string; joinedAt: Date | null } | null;
}
