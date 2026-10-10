# Unresolved Decisions

## Status Rule

None of the content here has become a current requirement. The original text with "suggestion", "tentative" and "requires confirmation" can only be used as discussion input; after the user makes a clear decision, he should enter specs through an independent OpenSpec change.

## P0 — Before Public Testing

| ID    | Decision needed                                                                                                            | Current known boundary                                                                                            | PRD source           |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| U-001 | safety officer minimum evidence and processing conditions required to impose temporary restrictions                        | No automatic penalty for a single appeal                                                                       | 17 / P0              |
| U-002 | SLA for temporary limit starting points, automatic recovery tasks, and safety officer handling appeals                     | The window for users to submit appeals is 30 minutes after it takes effect.                                    | 17 / P0              |
| U-003 | Whether to allow appeals to be permanently disabled, and what data and capabilities will be restored after passing         | Undecided                                                                                                         | 17 / P0              |
| U-004 | How to merge, conflict or unbind WeChat and Google identities when they belong to the same person                          | `issuer + subject` is not enough to solve cross-provider merge                                                    | 8 / account; 17 / P0 |
| U-005 | Downgrade process when OAuth fails, cancels authorization, or missing data                                                 | Undecided                                                                                                         | 17 / P0              |
| U-006 | Birth date modification, time zone boundary, verification failure and false age handling                                   | 18+ confirmed; strong age proof not confirmed                                                                     | 8 / account; 17 / P0 |
| U-007 | STT supplier, supplier side retention, deletion certificate and cross-border data description                              | The maximum length of 1 week is only the upper limit direction, and the access party has not yet been determined. | 9.3–9.4；17 / P0     |
| U-008 | Current limiting threshold for sharing link abuse, incorrect password, frequent entry and exit, and repeated reporting     | The current must be limited, but the parameters and feedback are not determined                                   | 17 / P0              |
| U-009 | Report, penalty, appeal and audit data retention period for account cancellation                                           | The direction of soft deletion has been confirmed, but the specific period has not been confirmed.                | 9.3；17 / P0         |
| U-010 | Single administrator account loss, handover and safety officer account recovery mechanism                                  | Undecided                                                                                                         | 17 / P0              |
| U-011 | When the room host is in the 60-second disconnection window, can members continue to communicate and can new members join? | The original text only has suggestions and has not been confirmed.                                                | 17 / P0              |
| U-012 | The order of wheat position when ordinary members join again after leaving.                                                | The original text suggested queuing to the end, unconfirmed                                                       | 17 / P0              |
| U-013 | Whether the room host is handed over immediately when it is restricted or permanently disabled in the room                 | The original text recommended immediate transfer, not confirmed                                                   | 17 / P0              |

## Product and Privacy Boundaries

| ID    | Decision needed                                                                                                  | Why unresolved                                                                      | PRD source        |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- |
| U-014 | Who can see the gender, nationality/city, interests and birth information in the profile?                        | PRD defines the collection field and the foreground visibility is not fully defined | 8 / account; 9.3  |
| U-015 | Whether both parties are prohibited from entering the same room after blocking, and how to display the room list | "Reduce interaction as much as possible" is not testable                            | 8 / Safe; 17 / P1 |
| U-016 | Are publicly discoverable, link-only joining, and password protected independent dimensions?                     | PRD uses three descriptions at the same time, the combination rules are not defined | 5.1;8/room        |
| U-017 | The exact event of switching from "Waiting" to "In Progress"                                                     | "Start communication" lacks a decidable condition                                   | 7                 |
| U-018 | Room closing, grace and reconnection processing after the default end time                                       | There is an end time but no complete expiration status rule                         | 5.1；7            |
| U-019 | Whether the target language of AI is always English, and native language recognition and contextual input rules  | PRD uses "target language" and no selection rules are given                         | 1.1；8 / AI       |
| U-020 | Which fields are specifically saved for short-term risk signals in the reporting evidence package?               | Minimum set needs to be defined without retaining complete transcription            | 9.5；15.14        |

## P1 — After Core Loop Stabilizes

| ID    | Decision needed                                                                           | PRD source |
| ----- | ----------------------------------------------------------------------------------------- | ---------- |
| U-021 | Appointment reminder channel                                                              | 17 / P1    |
| U-022 | Whether to allow manual addition after keyword generation fails                           | 17 / P1    |
| U-023 | Friend request validity period, rejection, withdrawal and notification policy             | 17 / P1    |
| U-024 | Idle status copy, refresh frequency and abnormal disconnection expiration time            | 17 / P1    |
| U-025 | Room history display cycle                                                                | 17 / P1    |
| U-026 | Active duration, deduplication and anti-swipe rules                                       | 17 / P1    |
| U-027 | Backend page, batch operations and secondary confirmation                                 | 17 / P1    |
| U-028 | The experience of running out of extension times, leaving before the end, and re-entering | 17 / P1    |
| U-029 | The relationship between reservation quota and actual quota and overcapacity handling     | 17 / P1    |
| U-030 | Mutual visibility of blocked users in room lists, friend searches, and free lists         | 17 / P1    |
