import { Inject, Injectable } from '@nestjs/common';
import type {
  SafetyActor,
  SafetyAppealDecision,
  SafetyCaseQuery,
  SafetyResolveInput,
} from '../../domain/entities/safety.js';
import { SAFETY_REPOSITORY, type SafetyRepository } from '../../domain/ports/safety.repository.js';
import { SafetyQueue } from '../../infrastructure/safety-queue.service.js';

@Injectable()
export class SafetyService {
  constructor(
    @Inject(SAFETY_REPOSITORY) private readonly repository: SafetyRepository,
    private readonly queue: SafetyQueue,
  ) {}

  listCases(actor: SafetyActor, query: SafetyCaseQuery) {
    return this.repository.listCases(actor, query);
  }
  detail(actor: SafetyActor, caseId: string) {
    return this.repository.caseDetail(actor, caseId);
  }
  evidence(actor: SafetyActor, caseId: string) {
    return this.repository.evidence(actor, caseId);
  }
  claim(actor: SafetyActor, caseId: string, clientRequestId: string) {
    return this.repository.claim({ actor, caseId, clientRequestId });
  }
  start(actor: SafetyActor, caseId: string, clientRequestId: string) {
    return this.repository.start({ actor, caseId, clientRequestId });
  }
  dismiss(actor: SafetyActor, caseId: string, clientRequestId: string, reason: string) {
    return this.repository.dismiss({ actor, caseId, clientRequestId, reason });
  }
  async resolve(input: SafetyResolveInput & { reason: string }) {
    const result = (await this.repository.resolve(input)) as {
      restriction?: { id?: string; endsAt?: string | null } | null;
    };
    if (result.restriction?.id && result.restriction.endsAt) {
      await this.queue
        .enqueue(
          { kind: 'restriction-expiry', id: result.restriction.id },
          new Date(result.restriction.endsAt),
        )
        .catch(() => undefined);
    }
    return result;
  }
  listRestrictions(actor: SafetyActor, input: { userId?: string; cursor?: string; limit: number }) {
    return this.repository.listRestrictions(actor, input);
  }
  ownRestrictions(userId: string, input: { cursor?: string; limit: number }) {
    return this.repository.listOwnRestrictions(userId, input);
  }
  lift(
    actor: SafetyActor,
    restrictionId: string,
    input: { clientRequestId: string; reason: string },
  ) {
    return this.repository.lift({ actor, restrictionId, ...input });
  }
  appeal(
    userId: string,
    restrictionId: string,
    input: { clientRequestId: string; reason: string },
    requestId?: string,
  ) {
    return this.repository.appeal({
      userId,
      restrictionId,
      ...input,
      ...(requestId ? { requestId } : {}),
    });
  }
  listAppeals(actor: SafetyActor, input: { status?: string; cursor?: string; limit: number }) {
    return this.repository.listAppeals(actor, input);
  }
  decideAppeal(
    actor: SafetyActor,
    appealId: string,
    input: { clientRequestId: string; decision: SafetyAppealDecision; reason: string },
  ) {
    return this.repository.decideAppeal({ actor, appealId, ...input });
  }
}
