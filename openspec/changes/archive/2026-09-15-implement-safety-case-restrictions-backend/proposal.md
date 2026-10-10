## Why

Currently, the backend can submit basic reports, and already has the role of safety officer and administrative audit. However, after the report is submitted, there is no case, evidence, processing status, account restrictions, appeal or closed loop recovery. V1 needs to first convert the reported facts into a safe treatment that is traceable, auditable and will not be mistakenly extended due to task delays, before it can truly implement the confirmed 3/12/24 hour limit and permanent ban on serious risks.

## What Changes

- Each successfully accepted report creates a security case in the same database transaction, retaining the report's one-to-one relationship with the case, processing status, assignment status, and stable request idempotent results.
- Automatically assign new cases to the safety officer with the fewest open cases; adopt deterministic rotation rules when parallel, and retain them as recoverable unassigned cases when there is no available safety officer.
- Added background case list, details, collection/start processing, evidence package viewing, case closure and rejection API; evidence only consists of existing reports, room members and timelines, room host management events and related historical signals, and does not save complete audio or transcription.
- Platform administrators can view all cases and evidence; only users who currently hold `SAFETY_OFFICER` can advance cases, impose or lift restrictions, handle appeals, and confirm permanent bans. Administrators can only perform these actions if they also hold the role of safety officer.
- Added three levels of temporary account restrictions: general, serious and high risk, lasting 3, 12 and 24 hours respectively; during the restriction period, users cannot create, join or reserve rooms through the current entrance, nor can they obtain real-time voice credentials.
- Use the PostgreSQL server start time and `endsAt` as the limit fact; the request path immediately identifies the expired limit, the recovery task is responsible for persistence convergence, and task delays must not extend the limit.
- Restricted users can view the minimum restriction information and submit an appeal within 30 minutes after the restriction starts; the safety officer can maintain the restriction or lift it in advance, and does not commit to the appeal processing time limit in this change.
- In serious or high-risk cases, the account can be permanently disabled after the safety officer clearly confirms the facts, and the immutable disposition and audit facts will be retained.
- All case reading, evidence reading, allocation, status advancement, restriction, release, appeal processing and permanent ban operations enter administrative audit; the only OpenAPI contract is updated, and failure paths such as permission bypass, repeated requests, concurrent processing, task delay and expiration recovery are covered.

### Confirmed Scope

- A single successfully accepted report corresponds to a security case; related reports, past cases, and restrictions are displayed as relevant signals in the evidence package. This change does not automatically merge cases.
- The general, serious, and high-risk temporary restrictions are fixed at 3, 12, and 24 hours; the start time is determined by the server transaction, and it will be deemed invalid after expiration.
- Temporary restrictions prevent currently existing access to create rooms, join rooms, obtain LiveKit credentials, and make reservations; logging in, viewing personal restriction information, and submitting appeals remain available. Subsequent room invitation changes must reuse the same restriction qualification judgment.
- Only one appeal is allowed for each temporary restriction, and the submission window is 30 minutes after the restriction starts; the safety officer can maintain or lift the restriction in advance.
- Permanent banning is only allowed in serious or high-risk cases and requires clear fact-confirming actions by the safety officer.
- PostgreSQL saves cases, assignments, evidence references, restrictions, appeals, and processing facts; background tasks are only responsible for scheduling and status convergence, and cannot be the only basis for whether restrictions are valid.

### Non-goals

- Does not implement room warnings, room disabling/restoring, or automatic kicking and room host takeover when the user has been restricted in a live room; these enter independent room security actions change.
- Does not implement user-to-user blocking, friend privacy, or friend room invitations.
- Does not implement streaming STT, sensitive word recognition, complete transcription, recording storage, or automatic punishment based on a single report/keyword.
- Does not implement PC management page, mobile new page or production deployment.
- Does not define appeal, recovery or re-registration rules after permanent ban, nor does it determine the security data retention, export and deletion periods in this change.

### Future Roadmap

- `implement-room-safety-actions-backend` adds room warning, disabling, recovery, real-time handling and room host takeover rules after account punishment in active rooms.
- Subsequent friend and blocking changes add user blocking, privacy isolation and friend invitations.
- Subsequent sensitive words and STT changes can add minimal risk events to the evidence package, but the complete transcription or direct automatic punishment cannot be saved.
- Operations and data governance changes determine security data retention periods, cleanup tasks, aggregation indicators, exception alerts, and audit exports.

### Unresolved Decisions

- Whether appeals are allowed for permanent disabling, who will restore it, and the data range after restoration have not yet been confirmed, so this change does not provide permanent disabling appeals or recovery APIs.
- How the new restrictions trigger kickouts, room host takeovers and room status changes when the user is already in an active voice room has not yet been confirmed, so this change only guarantees that subsequent requests and new credentials will be rejected.
- The safety officer's service time limit for handling temporary restriction appeals and the minimum sufficient conditions for case evidence still need to be confirmed by safe operation rules; this change only provides auditable manual work capabilities and does not automatically impose penalties based on default rules.

## Capabilities

### New Capabilities

- `safety-case-management`: Report-driven security cases, automatic assignments, processing status, evidence packages and background case operations.
- `user-safety-restrictions`: 3/12/24 hour temporary restriction, cross-entry enforcement, automatic recovery, early release and permanent ban for serious risks.
- `safety-restriction-appeals`: An appeal from a restricted user within a 30-minute window, and a closed loop for the safety officer to maintain or lift the restriction.

### Modified Capabilities

- `basic-safety-reporting`: When a report is successfully accepted, it must be created atomically and only one security case must be created, and an associated acceptance result must be returned.
- `backoffice-access-control`: Increase case viewing and safety processing permissions, and maintain the separation of responsibilities between platform administrators and safety officers.
- `backoffice-audit`: Incorporate security cases, evidence, restrictions, appeals, and permanently disabled reads and operations into background auditing.

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Mainly affects `moderation`, `backoffice`, `users`, `rooms`, reservations and real-time voice portals, as well as Prisma models/migrations, recovery tasks and `openapi/openapi.yaml`.
- Added case, evidence, restriction, appeal and disposition API; existing report submission responses remain backward compatible, only optional association information is added.
- Case creation, automatic assignment, limit changes, user status changes, and successful auditing require clear transaction and concurrency boundaries; all changes must support stable idempotent and preserve traceable facts.
- No new external provider is added; local acceptance relies on PostgreSQL, Redis/BullMQ and existing modules. LiveKit Cloud only verifies the restrictions and cannot issue new certificates, and does not record the unfinished real Cloud smoke as passing evidence for this change.
