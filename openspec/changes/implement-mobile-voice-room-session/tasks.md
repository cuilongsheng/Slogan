## 1. Contract, design and dependencies

- [x] 1.1 Save voice room V2, reconnection, end and room host end confirmation screenshots through Desktop Bridge, record key coordinates and elements that cannot be supported by API; check that the screenshots are consistent with the node information.
- [x] 1.2 Compare the generated client's list of request/response and error codes for joining, members, credentials, leaving, and ending; mark available fields and gaps in the acceptance record.
- [x] 1.3 Install fixed version of Web/native LiveKit SDK and Expo plugins, separate platform entry; use Web export and native configuration generation/build check to verify that dependencies are available.

## 2. Check-in business and recovery

- [x] 2.1 Implement membership, credentials, membership, leave and end calls through the existing authentication API client; use client testing to verify that the path, request body, error classification and sensitive values ​​do not enter the URL/log.
- [x] 2.2 Implement the join state machine that is only triggered by the user and access it on the device page; use tests to verify passwords/rules, repeated clicks, join failures, and retry/exit paths for failed credentials after joining successfully.
- [x] 2.3 Implement server-side membership recovery and invalid session convergence after refresh; use tests to verify ACTIVE, LEFT, REMOVED, end and credential update.

## 3. Real-time audio and members

- [x] 3.1 Implement Web/native media adapters with muted-by-default connections, explicit microphone toggling, and resource release on disconnect. Adapter tests and platform builds verify that the local device never publishes audio automatically.
- [x] 3.2 Merge API member facts with real-time presence/talk/microphone events and re-pull periodically; use tests to verify updates after ordering, room host changes, offline and member removal.
- [x] 3.3 Implement reconnection, termination and exit processing; use tests to verify the `expectedCredentialVersion` that actively exited, the exit failure feedback, and the old credentials cannot be re-entered after the server ends.

## 4. Page and design verification

- [x] 4.1 According to the V2 original, the room subject, microphone, member, and exit operations are implemented; compared with the original in the 390×844 Web screenshot, the undelivered functions remain clearly unavailable.
- [x] 4.2 Implement reconnection, exit confirmation, end page and compare with corresponding Figma; use routing test to confirm refresh, exit and end navigation.
- [x] 4.3 Use two local qualified test accounts to complete the API and browser session walkthrough, verify the default mute, member status, leave and no sensitive logs; clean the test data and save the running screenshots.

## 5. Acceptance

- [x] 5.1 Run mobile lint, typecheck, affected tests, Web/iOS/Android build or export, OpenSpec strict and format check; record real dual-device LiveKit audio and disconnection acceptance status, cannot be replaced by simulated media.
