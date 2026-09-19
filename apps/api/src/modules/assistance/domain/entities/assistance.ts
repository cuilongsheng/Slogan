export const ASSISTANCE_TONES = ['NEUTRAL', 'CASUAL', 'POLITE'] as const;
export type AssistanceTone = (typeof ASSISTANCE_TONES)[number];

export interface ExpressionAlternative {
  text: string;
  tone: AssistanceTone;
}

export interface ExpressionOutput {
  primary: ExpressionAlternative;
  alternatives: ExpressionAlternative[];
  noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE';
}

export interface AssistanceContext {
  roomId: string;
  topic: string;
  cefrLevel: string;
}

export type ExpressionInputMode = 'TEXT' | 'AUDIO';
export type ExpressionStatus =
  'RESERVED' | 'STT_RUNNING' | 'AI_RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNCERTAIN';

export interface ExpressionResult extends ExpressionOutput {
  requestId: string;
  generatedAt: Date;
  expiresAt: Date;
}

export interface ConsentState {
  purpose: 'AI_EXPRESSION_AUDIO' | 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS';
  noticeVersion: string | null;
  providerCategory: string | null;
  status: 'ACCEPTED' | 'REVOKED' | 'REQUIRED';
  changedAt: Date | null;
}
