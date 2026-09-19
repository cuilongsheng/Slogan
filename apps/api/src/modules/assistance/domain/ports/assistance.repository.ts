import type {
  ConsentState,
  ExpressionInputMode,
  ExpressionOutput,
  ExpressionResult,
  ExpressionStatus,
} from '../entities/assistance.js';

export const ASSISTANCE_REPOSITORY = Symbol('ASSISTANCE_REPOSITORY');

export type ReservationResult =
  | { kind: 'NEW'; requestId: string; leaseToken: string }
  | { kind: 'REPLAY'; result: ExpressionResult }
  | { kind: 'FAILED'; errorCode: string }
  | { kind: 'IN_PROGRESS'; retryAfterSeconds: number }
  | { kind: 'EXPIRED' };

export interface AssistanceRepository {
  reserve(input: {
    userId: string;
    roomId: string;
    clientRequestId: string;
    mode: ExpressionInputMode;
    digest: string;
    inputSize: number;
    audioReservedSeconds: number;
    now: Date;
  }): Promise<ReservationResult>;
  transition(input: {
    requestId: string;
    leaseToken: string;
    from: ExpressionStatus[];
    to: ExpressionStatus;
    providerCategory?: string;
    audioDurationMs?: number;
  }): Promise<void>;
  succeed(input: {
    requestId: string;
    leaseToken: string;
    output: ExpressionOutput;
    generatedAt: Date;
    expiresAt: Date;
  }): Promise<ExpressionResult>;
  fail(input: {
    requestId: string;
    leaseToken: string;
    errorCode: string;
    uncertain: boolean;
    at: Date;
  }): Promise<void>;
  recordUsage(requestId: string, kind: 'AI_EXPRESSION' | 'STT_AUDIO', units: number): Promise<void>;
  consent(input: {
    userId: string;
    clientRequestId: string;
    action: 'ACCEPT' | 'REVOKE';
    noticeVersion: string;
    providerCategory: string;
    now: Date;
    purpose: 'AI_EXPRESSION_AUDIO' | 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS';
  }): Promise<ConsentState>;
  consentState(
    userId: string,
    purpose: 'AI_EXPRESSION_AUDIO' | 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
    noticeVersion: string,
  ): Promise<ConsentState>;
  purgeExpired(requestId?: string, now?: Date): Promise<number>;
  pendingOutputExpiries(now?: Date): Promise<Array<{ id: string; outputExpiresAt: Date }>>;
}
