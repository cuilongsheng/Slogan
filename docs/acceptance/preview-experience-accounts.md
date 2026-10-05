# Preview experience accounts — implementation evidence

Date: 2026-10-03. Change: add-preview-experience-accounts. Branch: codex/preview-experience-accounts. Local worktree only; no push, merge or remote deployment.

## Approved boundaries

The latest human direction selects the original loopback development database 127.0.0.1:5432/slogan, allows old development identities to be retired, and requires exactly five usable accounts. This supersedes retaining every old test identity. Destructive global database cleanup and remote operations remain prohibited. Backups and random credentials are owner-only 0600, gitignored files; no credentials are recorded here. The original .env/AI settings remain unchanged.

The reviewed exception preserves normal registration/email verification and recovery. Controlled credentials truthfully use PREVIEW_PROVISIONED with verifiedAt=null and an active matching environment record. Sessions and RBAC recheck the server-side state. No unauthenticated seed API or global HOST permission exists.

## Verification recorded

- Targeted configuration and preview HTTP/RBAC/lifecycle/mail tests: 19 passed.
- Additive migration exercised in a transactionally isolated PostgreSQL schema with all preceding migrations: original hash/version/verifiedAt/session/audit unchanged; invalid source/time combination rejected. No real development tables were used by automated tests.
- Generated sole OpenAPI and api-client schema; generated-client check, client tests (2), admin/mobile/client typechecks passed.
- Full API verification initially exposed a pre-existing time-dependent operations fixture: a September query range excluded an event created at current October time. Fixture now uses a deterministic September timestamp; subsequent result recorded below.
- Local custom-format backup created before migration/cleanup, archive listing succeeded, permissions 0600. This checks archive structure; a full recovery drill has not been performed.

## Outstanding acceptance

The Desktop Bridge was disconnected. No Figma access fallback or UI implementation was performed. Tasks for capabilities in login/routes and 390x844 Chinese/English visual acceptance remain open. Existing frontend authentication still receives normal API/RBAC enforcement; its closed-mail entry visibility is not yet updated.

Real Google, LiveKit audio/public webhook, three independent web microphone clients, real device and formal release remain unverified. Ordinary email-auth SMTP/domain/inbox smoke remains independently blocked. Local unit/HTTP tests and OpenSpec strict validation do not satisfy these gates. Do not archive the entire change as complete.

## Executed original development database operation

- Target reconfirmed: loopback PostgreSQL 127.0.0.1:5432/slogan; 20 prior completed migrations and one ACTIVE old identity. Custom-format backup written before changes; owner-only 0600 and archive listing checked. No remote resource or unrelated-table cleanup.
- Additive migration 20261003000000_preview_experience_accounts deployed successfully (21 completed migrations).
- Guarded cleanup-local retired one old identity using account lifecycle behavior; roles revoked with explicit SYSTEM_JOB audit and terminal maintenance-marker FK. Older history/audit retained.
- Dry-run wrote no users; initialize created five; existing bootstrap created the first admin; its real password-authenticated CLI session called normal HTTP grant/revoke. Final READY state and repeated initialization created=false verified.
- Aggregate checks: ACTIVE users=5, active PLATFORM_ADMIN=1, active SAFETY_OFFICER=1, completed non-retired mappings=5, source PREVIEW_PROVISIONED with verifiedAt=NULL=5, no unrevoked session owned by retired users.
- Actual normal password HTTP login and own identity/source projection passed for all five. Mobile eligibility=3; ordinary direct backoffice access denied; safety role management denied; ordinary last-admin protection returned 409; closed email registration returned 503. Avatar URL served locally and returned 200. Test sessions explicitly logged out.
- Actual normal room HTTP create and two membership joins produced three independent members. B subsequently created its own room and became host. End requests committed, but realtime-disabled provider cleanup returned 503 REALTIME_PROVIDER_UNAVAILABLE; five verification rooms remain ENDING with durable cleanup commands, zero OPEN rooms. These are verification history and pending cleanup, not permanent seeded rooms or audio proof. Their presence does not add users or backend roles. LiveKit activation/recovery is separate work.
- Repeated verification logins hit the existing 20-source-attempt/900-second limit. Only counters computed using the newly generated local-preview HMAC for this verification source and these five targets were reset; other Redis keys/database state and configured limits were preserved. Counters are cleared after verification for handoff usability.
- Final full API verification: 92 suites, 513 tests passed (221 unit, 198 integration, 94 HTTP E2E), lint/typecheck/build/OpenAPI check passed. The room-history suite showed one transient authentication failure on an earlier full run; its isolated rerun and final full run passed without a code change. Cookie header redaction added and verified before real browser requests; credentials never printed or included in screenshots/traces.

## Private handoff files and running local services

Credentials: /Users/cls/Documents/Slogan/.env.preview-accounts.json. Runtime: /Users/cls/Documents/Slogan/.env.preview-runtime. Pre-change recovery backup: /Users/cls/Documents/Slogan/.env.preview-backup-20261003.dump. All are gitignored owner-only 0600. Do not print their contents into logs or chats.

API currently serves 127.0.0.1:6262 from the implementation worktree; admin Vite serves 127.0.0.1:5173, assets serve 127.0.0.1:6263. No mobile frontend server has been started. The primary checkout's original .env/AI configuration is unchanged; the private preview runtime disables AI/STT/realtime.

## Real browser result

Headless Playwright against the running local API/admin, with five independent browser contexts and real newly provisioned password credentials, passed: admin normal /rooms navigation, safety /safety/cases navigation and /roles denial, three ordinary accounts' direct-route denial, HttpOnly scoped refresh cookie with no refresh token in response body, and administrator full-page reload using a successful cookie refresh. No OAuth/provider mock, screenshot, trace or secret output was used. Browser test sessions were logged out. This proves password/browser/RBAC behavior; it does not prove real Google OAuth or the pending mobile capability UI.
