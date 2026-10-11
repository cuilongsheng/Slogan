## Context

See proposal.md for motivation. The existing `PreviewAccountsService` requires exactly five private slots, distinct passwords, and `assertNewPassword`; `12345678` is explicitly blacklisted. Private provisioning is idempotent and does not rename/reset accounts. The backoffice permission matrix has four roles. `AUDITOR` has access to real audits and governance records; `OPERATIONS_ANALYST` lacks the requested room-summary experience. Neither is an appropriate public-account substitute.

## Goals / Non-Goals

**Goals:** Retain ordinary auth/session machinery, preserve private identities, add a narrowly public provisioning path and a deny-by-default public viewer.

**Non-Goals:** See proposal.md. No anonymous production API, broad weakening of login, sharing of private identities, or synthetic records represented as real production activity.

## Decisions

1. Add explicit persisted public-trial ownership metadata per environment, with unique account ownership, separate from the five-slot private preview registry. Use a controlled CLI with explicit target, dry-run, atomic create, status, and disable operations. Do not change five-slot initialization or repurpose its administrator slot.
2. Reuse the existing password hasher and exchange/session flow. The public CLI permits the selected eight-character shared password; normal `assertNewPassword` stays unchanged. Marked trial accounts cannot change their public credentials or be granted private backoffice roles. Login still applies existing rate limiting and account availability checks.
3. Add `PUBLIC_TRIAL_VIEWER` with only backoffice access and a dedicated public-safe room-summary permission. Resolve current persisted roles on every request. A restricted projection omits host/account identifiers, private evidence, audit payloads, and access secrets. Existing administrative endpoint semantics remain unchanged; reuse an existing route only if its role-aware response can satisfy this boundary without contract ambiguity, otherwise add an explicit public-viewer route under the authenticated backoffice contract.
4. Generate the sole `openapi/openapi.yaml` from NestJS, then regenerate clients. Never hand-maintain a second contract. The admin shell recognizes the viewer, shows its allowed room view, and hides non-permitted navigation/actions; backend guards remain authoritative. Reuse approved existing room-list visual design and provide original-to-runtime evidence through the project figma-to-frontend workflow when implementing the altered interaction state.
5. Root README credentials are intentionally public. Publish them only after provisioning and deployed authorization verification. Keep maintainer/admin/safety secrets private. The two mobile users remain normal product users with existing room permissions and quotas. Shared accounts may have overlapping sessions and visible activity; documentation must state this limitation.

## Risks / Trade-offs

- Shared public identities can be abused or contend over rooms → keep existing capacity, quotas, rate limits, moderation, and a scoped disable/session-revocation operation; do not promise per-visitor privacy or isolated room ownership.
- Read-only access can still leak data → allowlist projections and endpoints; refuse real audit/safety/governance reads, rather than assigning existing AUDITOR.
- Global password exceptions could spread → confine the exception to the controlled public provisioning path and persisted public identities; reject normal weak-password writes.
- Existing sessions may outlive role changes → resolve account/public-access state and role persistence on requests and revoke sessions on disable.

## Migration Plan

1. Back up the named target and add public-trial metadata plus the additive role/permission representation. Do not rewrite historical migrations or private-account rows.
2. Deploy server authorization/projection support before exposing the viewer in clients. Refresh the generated contract/client types and deploy admin handling.
3. Dry-run the dedicated provisioning operation. Fail on unrelated username collisions. Initialize the public identities atomically; record only IDs/status/counts, not password values, in execution logs.
4. Verify the target deployment's allowed reads, direct mutation denials, data redaction, revocation, and ordinary login. Publish bilingual credentials only after those checks. No implementation or tests are executed in this planning turn.
5. Roll back exposure by disabling public-trial access and revoking only its sessions/role assignments, then remove the public README instructions. Preserve private accounts and retain additive schema/enum values until dependent application versions and rows are safely retired. Do not destructively drop enum values during emergency rollback.

## Evidence Required

Role/provisioning policy checks, upgrade and idempotency database evidence, direct HTTP denial and redaction evidence, English/Chinese README parity, and admin viewer navigation against the existing approved visual structure. Google provider and Android validation remain separate deployment evidence. Automated checks are deferred under the user's no-tests instruction and cannot be labeled PASS.
