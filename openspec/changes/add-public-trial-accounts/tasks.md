## 1. Architecture and persistence

- [x] 1.1 Review the scoped public-password exception, public viewer dataset, migration, and rollback decisions; verify the reviewed design preserves all private identities and normal password policy.
- [x] 1.2 Add additive public-trial ownership metadata and PUBLIC_TRIAL_VIEWER role support; verify the migration diff contains no private-account reset or historical migration rewrite, then record upgrade evidence when checks are authorized.

## 2. Provisioning and authorization

- [x] 2.1 Implement explicitly targeted dry-run, atomic provision, status, and disable/session-revocation operations; verify idempotency, unrelated username collision refusal, and unchanged five-slot private provisioning.
- [x] 2.2 Permit the public shared password only through trial provisioning and prevent trial self-service credential changes/private-role elevation; verify ordinary weak-password rejection and password-free logging.
- [x] 2.3 Add a sanitized authenticated public viewer room-summary API and deny private reads/business mutations; verify endpoint allowlists, current-role resolution, direct-request rejection, and field-level redaction.
- [x] 2.4 Generate the sole OpenAPI contract and client role/response types from the NestJS implementation; verify generated diffs agree with the public viewer projection and preserve existing roles.

## 3. Client and public documentation

- [ ] 3.1 Use the project figma-to-frontend workflow for the viewer's existing room-list layout and permission states; verify allowed navigation works, mutation controls are absent, and original-to-runtime evidence covers the altered state.
- [ ] 3.2 Prepare reciprocal English/Chinese README instructions for demo_s1, demo_s2, demo_m1 and the shared public password; verify private credentials are absent and publication remains conditional on successful target provisioning.

## 4. Acceptance and release

- [ ] 4.1 When testing is authorized, run the affected auth/provisioning/role/API checks once and record denial, redaction, revocation, migration, and compatibility evidence; until then mark checks unexecuted rather than PASS.
- [ ] 4.2 Back up the named target, apply compatible migrations, deploy the API/client support, dry-run then provision the public identities; verify deployed login, read boundaries, direct mutation denials, and private account compatibility before publishing credentials.
- [ ] 4.3 Publish the verified public account instructions in both root READMEs and record deployed commit/configuration/provisioning evidence plus disable/revocation rollback steps; verify repository homepage language links and trial entries match the target release.

Implementation note (2026-10-11): additive schema, explicit target CLI, auth restrictions, sanitized endpoint and generated client are implemented. Migration and dry-run completed on slogan-preview; automated suites were not executed. Deployed boundary checks and public README publication are still release gates.
