## Purpose

Define data classification, versioned retention policies, and recoverable cleanup execution boundaries to enable timely deletion of temporary content as promised while avoiding accidental deletion of security, audit, identity, and user content facts when deadlines or legal grounds are not approved.

## ADDED Requirements

### Requirement: Each type of data has clear management classification and default actions

The system MUST classify governed data into at least temporary voice content, short-term AI output, temporary coordination status, technical commands/jobs, operational metrics, account identities, user private content, security evidence, penalties/grievances, and background audits. The configured retention limit for temporary voice content MUST not exceed seven days and be deleted immediately after priority processing; account identities, security evidence, penalties/appeals, background audits and user private content that have not been approved for a specific period MUST default to `RETAIN` and MUST not be automatically physically deleted by scheduled tasks.

#### Scenario: Security evidence period not configured

- **WHEN** Cleaning runner scan reports, cases, restrictions, appeals or administrative audit data without an approved enablement policy
- **THEN** The system skips these records and records the reasons for retention, and does not delete them based on the creation time.

#### Scenario: Temporary content has expired

- **WHEN** Temporary content exceeds the enabled policy period of no more than seven days
- **THEN** The system includes it as a candidate for cleanup and does not extend or copy the original content.

### Requirement: Retention policy versioning, controlled enablement, and non-retroactive rights expansion

The system MUST save the policy version, data category, scope, period, basis reference, effective time, creator and activation status. Only `PLATFORM_ADMIN` can create or enable the policy; shortening the retention period for security evidence, penalties/appeals, audits, account identities, or user private content MUST be denied until explicitly allowed by a separate OpenSpec requirement. Policy changes MUST only affect runner selection after taking effect, and historical cleanup results MUST not be falsified.

#### Scenario: Administrator enables temporary data policy

- **WHEN** The platform administrator enabled a temporary data policy that meets the existing maximum age
- **THEN** The system saves the immutable version and audit, and references this version in subsequent runs.

#### Scenario: Request to delete unapproved categories

- **WHEN** The administrator attempted to enable physical deletion for security evidence or background auditing via configuration or API
- **THEN** The system returns a stable conflict and does not establish an executable policy

### Requirement: Dry-run the cleaning first and then execute it in batches

The system MUST support dry-run by policy version, returning the number of candidates, earliest/latest times, categories, and irreversible impact summary, without returning content. Actual cleanup MUST require the same unexpired dry-run ID, caller UUID request ID, and explicit confirmation, and be performed according to the configured batch limit; ordinary scheduled cleanup can only perform temporary or technical categories that have been pre-approved to run automatically.

#### Scenario: Execute after dry-run

- **WHEN** An authorized administrator confirmed the cleanup with the same policy version and unexpired dry-run results
- **THEN** The system creates an idempotent run and only processes records that still meet the criteria within the boundaries of the dry-run

#### Scenario: Candidate changed before confirmation

- **WHEN** A candidate is overwritten by preservation hold after dry-run or no longer meets the policy
- **THEN** The actual operation skips this record and states it in the result count, without bypassing the latest protection status

### Requirement: Cleanup run with leases, fencing, recovery and min-proof

The system MUST save state, policy versions, boundaries, lease generation, batch cursors, scan/delete/skip/failure counts, stable errors, and start/end times for each run. The expired runner MUST not submit late results; after the process is restarted, the new runner MUST continue from the submitted cursor, and retries MUST not duplicate deletions or error accumulation.

#### Scenario: Restarting during cleanup

- **WHEN** runner stopped after partial batch submission
- **THEN** The new runner continues from the last committed cursor and keeps the final count consistent with the actual deletion

#### Scenario: The old lease is late for submission

- **WHEN** The expired runner submits batch results after the new generation takes over.
- **THEN** The system rejects the submission and does not overwrite the new running status.

### Requirement: Cleanup respects referential integrity and preservation hold

The system MUST verify that technical or temporary records are no longer relied upon by active orders, cases, audits, idempotent replays, user-visible results, or recovery processes before deleting them. The system MUST support preservation holds by category, target, or time range; records that hit hold MUST not be deleted. Cleanup failed MUST atomically roll back the current batch and generate an exception fact with no content.

#### Scenario: Technical command still in recovery window

- **WHEN** A command is still pending, can be retried if it fails, or is referenced by business results
- **THEN** Cleanup skips this command and preserves recovery capabilities

#### Scenario: Batch deletion violates reference constraints

- **WHEN** Any deletion in the current batch would destroy the referential integrity that allows the facts to be preserved
- **THEN** All current batches are not submitted and management exceptions are recorded.

### Requirement: Governance queries are minimized and all sensitive operations are auditable

The system MUST allow `PLATFORM_ADMIN` to view policy, dry-run, and run and execute controlled commands, allow `AUDITOR` to read only policy versions, run results, and audits, and allow `OPERATIONS_ANALYST` to read only governance health trends aggregated by categories and results. Responses and audits MUST not contain original audio, transcriptions, AI text, report text, private notes, vocabulary content, mobile phone numbers, provider subjects, keys, or snapshots of deleted content.

#### Scenario: Auditor checks the running results

- **WHEN** Auditor queries a cleanup run
- **THEN** The system returns policy version, boundary, count, time and stable results, but does not return candidate identification or content

#### Scenario: Sensitive operation audit failed

- **WHEN** Audit required for policy enablement, hold modification, actual cleanup command or running results cannot be persisted
- **THEN** The system does not accept this control plane operation and returns a stable error without internal details.
