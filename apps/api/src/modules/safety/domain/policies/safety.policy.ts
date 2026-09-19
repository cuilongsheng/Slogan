import type { SafetyAppealDecision, SafetyResolution, SafetySeverity } from '../entities/safety.js';
import { SafetyError } from '../errors/safety.error.js';

const durations: Record<SafetySeverity, number> = {
  GENERAL: 3 * 60 * 60 * 1000,
  SERIOUS: 12 * 60 * 60 * 1000,
  HIGH_RISK: 24 * 60 * 60 * 1000,
};

export function restrictionEndsAt(severity: SafetySeverity, startsAt: Date): Date {
  return new Date(startsAt.getTime() + durations[severity]);
}

export function appealDeadline(startsAt: Date): Date {
  return new Date(startsAt.getTime() + 30 * 60 * 1000);
}

export function normalizeSafetyReason(value: unknown, maximum = 500): string {
  if (typeof value !== 'string') throw SafetyError.validation();
  const reason = value.trim();
  const length = [...reason].length;
  if (length < 1 || length > maximum) throw SafetyError.validation();
  return reason;
}

export function validateResolution(input: {
  resolution: SafetyResolution;
  severity?: SafetySeverity;
  factsConfirmed?: boolean;
}): void {
  if (input.resolution === 'NO_ACTION') {
    if (input.severity !== undefined || input.factsConfirmed !== undefined)
      throw SafetyError.validation();
    return;
  }
  if (!input.severity) throw SafetyError.validation();
  if (
    input.resolution === 'PERMANENT_DISABLE' &&
    (input.severity === 'GENERAL' || input.factsConfirmed !== true)
  )
    throw SafetyError.validation();
  if (input.resolution === 'TEMPORARY_RESTRICTION' && input.factsConfirmed !== undefined)
    throw SafetyError.validation();
}

export function caseCommandContent(input: {
  action: string;
  caseId: string;
  reason?: string;
  resolution?: SafetyResolution;
  severity?: SafetySeverity;
  factsConfirmed?: boolean;
}): string {
  return JSON.stringify(input);
}

export function appealCommandContent(input: {
  action: string;
  restrictionId?: string;
  appealId?: string;
  reason: string;
  decision?: SafetyAppealDecision;
}): string {
  return JSON.stringify(input);
}
