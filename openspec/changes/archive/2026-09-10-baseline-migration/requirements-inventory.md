# PRD V1 Baseline Migration Inventory

## Status

- Migration status: `DRAFT_FOR_USER_REVIEW`
- Input baseline: `PRD_V1.md` (currently not frozen)
- Candidate output: `openspec/changes/baseline-migration/specs/`
- Current requirements source of truth: **Not switched yet**

This list is only for classification and tracing. Candidate specs must not be synchronized, the original PRD must not be frozen, and candidate content must not be described as current requirements that are already in effect before the user explicitly approves it.

## Classification Rules

| Classification        | Judgment criteria                                                                         | Whether to allow entry into candidate specs | Is MUST/SHALL allowed? |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------- |
| Confirmed requirement | The user has explicitly decided and it falls within the current `0.0.1` delivery boundary | Yes                                         | Yes                    |
| Future roadmap        | Planned but does not belong to `0.0.1`, or belongs to the direction after V2              | No                                          | No                     |
| Unresolved decision   | Suggestions, conflicts, missing boundaries, or selection still required                   | No                                          | No                     |
| Historical context    | Vision, goals, research, communications, indicators or context for discussion             | No                                          | No                     |

## Confirmed Requirements Migrated as Candidate Specs

| ID    | Requirement summary                                                                                                                                                          | PRD source                               | Candidate capability          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------- |
| C-001 | Supports WeChat and Google third-party login, first authentication to create an account                                                                                      | 8 / P0 account; 16.1–16.2                | `identity-and-profile`        |
| C-002 | When logging in for the first time, you must complete the avatar, name, gender, nationality/city, interests, CEFR, and date of birth.                                        | 8 / P0 account; 16.2                     | `identity-and-profile`        |
| C-003 | You cannot enter the room service before the data is completed.                                                                                                              | 6.1;8/P0 account                         | `identity-and-profile`        |
| C-004 | People under 18 cannot create, join or accept room invitations                                                                                                               | 8 / P0 account; 15.2; 16.2               | `identity-and-profile`        |
| C-005 | The default language for Chinese devices is Chinese, and the default language for other devices is English; the first version only provides Chinese and English.             | 8 / P0 account; 16.2                     | `localization-and-room-rules` |
| C-006 | Sensitive topics and behavioral rules are displayed before entering the room, and the user must confirm before continuing.                                                   | 8 / P0 voice room; 16.2                  | `localization-and-room-rules` |
| C-007 | You can still check the rules again after entering the room, the bilingual meaning is the same                                                                               | 8 / P0 voice room; 16.2                  | `localization-and-room-rules` |
| C-008 | Qualified users can create instant rooms for 2–6 people, CEFR and theme must be set                                                                                          | 5.1；15.1；16.2                          | `instant-room-discovery`      |
| C-009 | The instant room will be opened immediately after it is created, with a default duration of 2 hours.                                                                         | 5.1；15.10；16.2                         | `instant-room-discovery`      |
| C-010 | Supports public rooms and 4-digit password rooms                                                                                                                             | 8 / P0 room; 15.2; 16.2                  | `instant-room-discovery`      |
| C-011 | Provides room lists and details, and displays the information needed for the current version to be added and judged.                                                         | 8 / P0 room; 16.2                        | `instant-room-discovery`      |
| C-012 | Concurrent joins must not exceed the maximum number of people in the room                                                                                                    | 15.11；16.2；16.4                        | `instant-room-discovery`      |
| C-013 | At least two members can publish and subscribe to live microphone audio                                                                                                      | 12；16.1–16.4                            | `voice-session`               |
| C-014 | The user is muted by default when joining the room, and the user actively switches                                                                                           | 7;8/P0 voice room;15.2;16.2              | `voice-session`               |
| C-015 | The room displays member nicknames, CEFR, microphone status and room host identity                                                                                           | 8 / P0 Voice Room                        | `voice-session`               |
| C-016 | Provide reconnection, exit and error feedback for network exceptions                                                                                                         | 8 / P0 Voice Room                        | `voice-session`               |
| C-017 | Notify members after the room ends and refuse ordinary joining or re-entry with old credentials                                                                              | 6.4；7；16.2                             | `voice-session`               |
| C-018 | `0.0.1` does not enable room audio STT, does not record, does not save full transcription, and does not public playback                                                      | 8 / P0 voice room; 16.2                  | `voice-session`               |
| C-019 | Room host can view and remove members, and those who are removed cannot actively re-enter.                                                                                   | 8 / P0 room host management; 15.11; 16.2 | `host-controls`               |
| C-020 | Removed members can re-enter only if the room host re-invites and all qualification checks pass.                                                                             | 7；15.11；16.2                           | `host-controls`               |
| C-021 | When the room host actively exits, you can specify a successor. If not specified, the current second microphone will take over. If there is no successor, it will be closed. | 5.1；15.9；16.2                          | `host-controls`               |
| C-022 | The wheat positions are displayed in the order of successful joining. After members leave, they will be moved forward in the original order.                                 | 15.9；16.2                               | `host-controls`               |
| C-023 | The room host retains a 60-second reconnection window when disconnected from the network. It will be handed over or closed after timeout.                                    | 5.1；15.9；16.2                          | `host-controls`               |
| C-024 | The current version supports the submission of basic reporting records                                                                                                       | 8 / P0 safe; 16.2                        | `basic-safety-reporting`      |
| C-025 | Reporting, removal, invitation, transfer, disconnection and termination must leave audit events                                                                              | 15.9；16.2；16.4                         | `basic-safety-reporting`      |
| C-026 | Room and role permissions must be implemented on the server side and cannot rely solely on the client UI                                                                     | 12；16.2                                 | `basic-safety-reporting`      |
| C-027 | Real-time voice credentials must be short-term and limited to the target room. Old credentials cannot bypass removal or end status.                                          | 11 / real-time voice; 16.2               | `basic-safety-reporting`      |

## Future Roadmap — Not Migrated to Current Specs

Even if the direction has been clarified, the following items do not belong to `0.0.1` current requirements; OpenSpec changes should be established separately in the future, rather than written as MUST in this migration.

| ID    | Roadmap item                                                                                        | PRD source                                  | Intended batch |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------- |
| F-001 | Appointment creation, start/end time, cancellation, reminder and no-show limit                      | 5.4; 8 / P0 reservation; 16.3               | `0.0.2`        |
| F-002 | 10 minutes reminder before room end and room extension                                              | 7；15.10；16.3                              | `0.0.2`        |
| F-003 | Room and reservation history                                                                        | 16.3                                        | `0.0.2`        |
| F-004 | safety officer action page, 3/12/24 hour limit, appeal and permanent ban                            | 8 / Security and backend; 15.5; 16.3        | `0.0.2`        |
| F-005 | Simple post-meeting notes taken by users actively                                                   | 16.3                                        | `0.0.2`        |
| F-006 | Native text/short voice AI expression assistance                                                    | 8 / AI；15.4；16.3                          | `0.0.3`        |
| F-007 | Room-level temporary STT, sensitive word reminder and user consent                                  | 9.4；15.12；16.3                            | `0.0.3`        |
| F-008 | Automatic keyword summary and personal vocabulary book after the meeting                            | 8 / Precipitation after meeting; 15.6; 16.3 | `0.0.3`        |
| F-009 | Friends, available persons, mutual consent and friend invitation lists                              | 8 / P1 invitation; 15.16; 16.3              | `0.0.3`        |
| F-010 | Self-registration, international mobile phone number verification code and OAuth account merging    | 8 / P0 account; 16.3                        | `0.0.3`        |
| F-011 | STT supplier adaptation, quota, deletion and cross-border processing instructions                   | 9.4；11；16.3                               | `0.0.3`        |
| F-012 | Complete administrator/safety officer dashboard, indicators, abnormal alarms and cleanup strategies | 8 / P1 background; 16.3                     | `0.1.0`        |
| F-013 | Fixed group, community moderator, language exchange, 1v1, paid and professional functions           | 2.2；14 / Phase 3；`PLAN_V2.md`             | V2+            |

## Historical Context — Preserved, Not Converted to Requirements

| ID    | Context                                                                                                      | PRD source             | Preservation                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------- |
| H-001 | Project vision of building products, practicing English, getting to know overseas engineers and finding jobs | Document status; 1; 10 | Reserved at `PRD_V1.md`                                                                   |
| H-002 | User issues, product principles and chat system definition                                                   | 1–4                    | As a background for understanding, standard words are not directly generated              |
| H-003 | Overseas community verification, English introduction and job search communication methods                   | 13；`dev.md`           | Reserved for product research and distribution background                                 |
| H-004 | Activation, experience, retention, distribution and security metrics                                         | 10                     | as input for subsequent analytics change                                                  |
| H-005 | Early Phase 0–3 plan narrative                                                                               | 14                     | Superseded by version roadmap of its execution meaning                                    |
| H-006 | V1 non-targets such as video, live broadcast, pan-social, course market, etc. are explicitly excluded        | 2.2                    | Reserved as range background; create another change when long-term constraints are needed |

## Conflicts and Conservative Handling

- PRD’s complete V1 acceptance criteria include appointment, STT, AI and post-meeting precipitation, but `16.1–16.4` makes it clear that `0.0.1` is the first technical verification version; this time candidate specs adopt a narrower `0.0.1` boundary.
- PRD writes future capabilities as P0 or MUST in many places; version scheduling takes priority in determining whether this migration will enter current specs, and content that has not been entered will be retained as roadmap.
- All sentences with "suggestions" in Section 17 are retained as unresolved, and candidate specs are not written because the suggestions seem reasonable.
- Implementation constraints such as technology stack, Redis/Lua, and LiveKit Server API are not directly translated into product behaviors; only externally verifiable concurrency capacity, permissions, and credential boundaries are written into specs, and the specific implementation is left to Architecture/design.
