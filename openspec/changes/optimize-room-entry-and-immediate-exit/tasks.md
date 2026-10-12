## 1. Admission and credential preparation

- [x] 1.1 Remove unnecessary frontend detail reads, reuse account-bound fresh creation responses and display the admitted room while connecting; verify password/retry/disposal/active-membership paths.
- [x] 1.2 Reuse the reservation metadata and reduce provider provisioning round trips while preserving final authorization; verify deferred concurrency and adapter/security tests.

## 2. Immediate local exit and recovery

- [x] 2.1 Add root-owned account-bound persisted exit delivery and retries that survive room-screen disposal; verify uncertain responses, account changes and recovery.
- [x] 2.2 Route explicit leave/end and ended notifications to discovery without terminal/loading pages; retain validated designated/default host succession and device checks.
- [x] 2.3 Return host end after durable commit and move provider cleanup off the response path; verify slow/unavailable-provider behavior and recovery.

## 3. Evidence and delivery

- [x] 3.1 Record actual and simplified flow diagrams, runtime fixtures and separate latency/device evidence; synchronize requirements.
- [x] 3.2 Run consolidated affected verification, update PR #22 and publish matching main/API/Pages/APK after all gates pass.
