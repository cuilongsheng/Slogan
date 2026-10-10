## 1. Product process and visual confirmation

- [ ] 1.1 Draw the "Discover/Find Partner/Message/My" navigation and partner empty status, room host invitation, and ordinary user single chat entrance in `01 Prototype`; use clickable paths and screenshots to check that the contents of the three entrances are not repeated.
- [ ] 1.2 Draw recent conversations, friend entries, text conversations, unilateral deletion, voice request acceptance/rejection, busy/timeout, blocking and reporting low-fidelity status; use scene-by-scene walkthrough to record and confirm the results.
- [ ] 1.3 After confirming the low-fidelity process of the product, check the tokens/components of `00 Foundations` covering partner rows, session rows, message bubbles, call status and elastic layers; verify with component list and gap record.
- [ ] 1.4 Complete partner search, message list, session/call key high-fidelity page and necessary status based on confirmed tokens/components in `02 UI`; verify with Figma node screenshots and design review records.

## 2. Contract and persistence

- [ ] 2.1 Define partner query, session/message, personal deletion, voice request/accept/reject/end and error response in unique `openapi/openapi.yaml`; run contract verification and check that each new demand scenario has corresponding interfaces.
- [ ] 2.2 Adds forward-compatible Prisma migrations for sessions, messages, participant visible boundaries/read cursors, and call audit records; runs migrations and uniqueness/index validation.
- [ ] 2.3 Implement session query, history paging, stable order and unilateral deletion boundary filtered by the current user; use dual accounts and cross-login integration testing to verify that the other party's history is not affected.

## 3. Social and text messaging

- [ ] 3.1 Implement the availability, privacy, blocking filtering and paging of partner query; use the qualification invalidation and two-way blocking interface to test and verify.
- [ ] 3.2 Connect to the existing room host room invitation portal and re-verify the identity and target during operation; use room host success, non-room host rejection and capacity boundary test verification.
- [ ] 3.3 Implement bilateral qualification review, idempotent, text verification, unread and reconnect completion of text sending; use concurrent retry and cross-device history test verification.
- [ ] 3.4 implements speed limit for unfamiliar messages, message reporting and prohibition of new interactions after blocking; test and verify with server override, speed limit and security cases.

## 4. Single voice chat

- [ ] 4.1 Implement independent DirectCall request/accept/reject/timeout status and mutual exclusion occupancy; use concurrent requests, busy and expired to accept testing and verification.
- [ ] 4.2 Access exclusive real-time media sessions for both parties, only issue credentials after valid acceptance, and clean up when ending/blocking/losing contact; test and verify with third-party rejection, pre-acceptance without credentials, and real media environment.
- [ ] 4.3 implements minimal call event and disconnection recovery feedback, without writing recording or transcription; verified by session history check and disconnection device testing.

## 5. Mobile terminal interaction and delivery acceptance

- [ ] 5.1 Press the confirmed Figma to implement bottom navigation, find partner list and room host/normal user actions; use visual screenshots and actual room host permission paths to verify.
- [ ] 5.2 implements message list, friend entry, text history, sent/unread, personal deletion, blocking and reporting feedback; cross-login and dual-account path verification using real devices.
- [ ] 5.3 implements voice request, callee acceptance/rejection, call in progress, busy/timeout and end status; authenticated with dual-device real media path.
- [ ] 5.4 Run contract, migration, permission, concurrency, mobile and end-to-end tests of the affected scope, and record visual, operational, equipment, release rollback evidence; check that all scenarios of the four delta specs have acceptance results.
