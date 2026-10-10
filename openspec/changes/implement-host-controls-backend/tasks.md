## 1. Dependency handover and database expansion

- [x] 1.1 Verify the implemented public authorization/presence API, provider revocation, identity history, audit/outbox, queue and end path of LiveKit change, record the actual code and acceptance evidence link; stop dependent tasks when the front-end is not delivered, Cloud BLOCKED must not be changed to PASS
- [x] 1.2 Add ACTIVE/LEFT/REMOVED/INVITED, leave/remove fields to membership, and add hostDisconnectedAt/deadline/independent hostReconnectVersion to Room; verify that the pre-model is reused and tables are not re-created through Prisma validate and schema constraint testing
- [x] 1.3 Create subsequent additive migration and backfill ACTIVE, retaining old membership, joinOrder, identity history and pending commands; verify foreign key/index, data retention and rollback isolation boundaries through empty library upgrade chain and real PostgreSQL test with LiveKit running data fixture
- [x] 1.4 Expand the ACTIVE capacity/list/detail projection of rooms repository, historical maximum joinOrder and new identity/version allocation; verify last re-entry, leave release quota, last seat contention and transaction rollback through real database testing

## 2. Member departure, removal and re-invitation

- [x] 2.1 Implement active leave and LEFT rejoin of ordinary members, reuse qualifications/rules/passwords/room/capacity verification, and append old identity revoke; verify repeated leave through unit/integration testing, abnormal disconnection without leaving, order forward after leaving, re-entering the last position and new identity
- [x] 2.2 Implement room host remove/reinvite, verify the current actor, same-room target, lifecycle/target generation within the lock, and verify qualifications/capacity for invitations and joins; test verification rules through permission bypass, self-removal, cross-room, invitations not occupying space, the removed person re-entering by themselves, and old requests accidentally injuring new sessions
- [x] 2.3 will manage mutation, actor/target/reason/time/result audit and outbox atomic save, reuse provider first try/retry and distinguish pending/unavailable; verify through repeated requests, transaction rollback, reject action audit and provider failure/recovery test that there are no repeated successful events, and old identity retry does not revoke new sessions.

## 3. Active handover and termination

- [x] 3.1 Implement designated takeover of room host leave, default online minimum joinOrder takeover and no-candidate termination; verify illegal/offline successor rejection, original room host exit and role update atomicity through unit/row lock integration testing, and do not use the default one without authorization when the specification is invalid
- [x] 3.2 Implement the current room host end and reuse the pre-public end transaction/undo/delete, clear the old host reconnect window; verify the unique room host, end priority, repeated calls to idempotent and all join/tokens are rejected through host end, no candidate, expiry and concurrent leave/remove tests

## 4. room host reconnection window and resumable scheduling

- [x] 4.1 Access room host disconnection/recovery in the front-end normalized presence transaction, atomically save deadline, hostReconnectVersion, auditing and scheduling commands for 60 seconds; verify through frozen clock, repeated/reverse order/session switching and mid-crash test 59-second recovery retains permissions, does not create new windows for old events, or recaptures room host
- [x] 4.2 Extended join and realtime credential authorization, ACTIVE within the window can continue/restore, new users, LEFT, and INVITED are rejected and return ROOM_HOST_RECONNECTING/retryAt; the unoccupied capacity is verified through the directed service test, ACTIVE repeated join idempotent, and timeout unsettled cannot bypass the check
- [x] 4.3 Add host-timeout handler to the original BullMQ queue, review expected host/identity/reconnect version/deadline in the lock and press online joinOrder to transfer or end; verify expired job no-op, repeated tasks, deadline competition and endsAt priority through real Redis/PostgreSQL test
- [x] 4.4 Extended startup/cycle reconciliation to reschedule database window tasks, and hand over the disconnection/recovery caused by provider reconciliation to the same rule; it will be executed after Redis job loss, all webhook loss, worker restart and member action test verification recovery in the window, no early transfer, and normal stateVersion changes will not lose the effective timer

## 5. HTTP API and unique contract

- [x] 5.1 implements leave endpoint/DTO, ordinary members do not accept successorMembershipId, room host supports specified or default takeover; through HTTP E2E verification 401, invalid successor, atomic exit and no candidate end response
- [x] 5.2 Implement removals/invitations endpoint/DTO and target version anti-replay, reuse management application; verify ordinary members/old room host 403, cross-room targets, repeated requests and all qualifications after re-invitation through HTTP E2E verification
- [x] 5.3 implements host end endpoint and completes management error mapping and ENDING/pending results; the end is unrecoverable through HTTP E2E verification, provider failure does not falsely report completion, and repeated end returns existing results or stable conflicts.
- [x] 5.4 extends the lifecycle/window/role projection of memberships, members and realtime-credentials; via HTTP E2E verification REMOVED certificate rejection, LEFT/INVITED last re-entry, capacity consistency, in-window recovery and minimum privacy fields
- [x] 5.5 Use NestJS Swagger DTO/decorator to generate `openapi/openapi.yaml`; use parser and `pnpm --filter @slogan/api openapi:check` to verify four new endpoints, three existing extensions, target generation, stable errors and provider pending responses without drift

## 6. Business Smoke and Final Acceptance

- [ ] 6.1 In the isolated LiveKit Cloud environment, execute "Remove → Reject the old token → Re-invite → Join the new identity", specify/default takeover, 60-second recovery/timeout and host end disconnect business smoke; save the desensitization result, record BLOCKED when there is no certificate, and keep this item unfinished, do not prefix adapter smoke to replace business evidence
- [x] 6.2 Relate current host-controls, voice-session, basic-safety-reporting to this delta by design matrix in `docs/acceptance/implement-host-controls-backend.md`; record dependencies, migration/rollback walkthroughs, runtime/Cloud results and unexecuted items, UI selector/dual device audio/device permissions/product acceptance/deployment are not counted as completed
- [x] 6.3 After all implementations are completed, run `pnpm verify:api`, `pnpm format:check` and `pnpm deps:check` once, record the exact number of tests, Node, commands and PASS/FAIL/BLOCKED, and verify that the LiveKit foundation has not been copied or the original API has been destroyed; if it fails, first perform directed repairs and then rerun the final verification, and keep it unarchived waiting for applicable acceptance.
