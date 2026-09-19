import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client.js';
import type { BackofficeAuditAppendInput } from '../domain/entities/backoffice-audit.js';

// This explicit mapping is the audit payload whitelist. Callers cannot pass DTOs or requests.
export async function appendBackofficeAuditEvent(
  tx: Prisma.TransactionClient,
  input: BackofficeAuditAppendInput,
) {
  return tx.backofficeAuditEvent.create({
    data: {
      id: randomUUID(),
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorRoles: input.actorRoles,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      role: input.role ?? null,
      reason: input.reason ?? null,
      result: input.result,
      clientRequestId: input.clientRequestId ?? null,
      requestHash: input.requestHash ?? null,
      requestId: input.requestId ?? null,
      details: input.details ?? Prisma.JsonNull,
    },
  });
}
