import type {
  SafetyActor,
  SafetyAppealDecision,
  SafetyCaseQuery,
  SafetyCommandInput,
  SafetyResolveInput,
} from '../entities/safety.js';

export const SAFETY_REPOSITORY = Symbol('SAFETY_REPOSITORY');

export interface SafetyRepository {
  listCases(actor: SafetyActor, query: SafetyCaseQuery): Promise<unknown>;
  caseDetail(actor: SafetyActor, caseId: string): Promise<unknown>;
  evidence(actor: SafetyActor, caseId: string): Promise<unknown>;
  claim(input: SafetyCommandInput): Promise<unknown>;
  start(input: SafetyCommandInput): Promise<unknown>;
  dismiss(input: Required<SafetyCommandInput>): Promise<unknown>;
  resolve(input: SafetyResolveInput & { reason: string }): Promise<unknown>;
  listRestrictions(
    actor: SafetyActor,
    input: { userId?: string; cursor?: string; limit: number },
  ): Promise<unknown>;
  listOwnRestrictions(userId: string, input: { cursor?: string; limit: number }): Promise<unknown>;
  lift(input: {
    actor: SafetyActor;
    restrictionId: string;
    clientRequestId: string;
    reason: string;
  }): Promise<unknown>;
  appeal(input: {
    userId: string;
    restrictionId: string;
    clientRequestId: string;
    reason: string;
    requestId?: string;
  }): Promise<unknown>;
  listAppeals(
    actor: SafetyActor,
    input: { status?: string; cursor?: string; limit: number },
  ): Promise<unknown>;
  decideAppeal(input: {
    actor: SafetyActor;
    appealId: string;
    clientRequestId: string;
    decision: SafetyAppealDecision;
    reason: string;
  }): Promise<unknown>;
  expire(restrictionId: string): Promise<boolean>;
  recoverAssignments(): Promise<number>;
  recoverableRestrictionIds(): Promise<Array<{ id: string; endsAt: Date }>>;
}
