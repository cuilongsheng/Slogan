## Why

The local backend for instant voice room, room host management and basic reporting has been delivered. The next step is to allow users to arrange communication time in advance and obtain a confirmed reservation quota. The reservation has not yet entered the current specs. This change will be independently proposed based on the reservation confirmed by the user, and will not copy the reminders, no-show penalties or time limits in the historical PRD.

## What Changes

- Added the creation, discovery and details of reservation rooms, including clear start/end times; automatic opening at the time, and reuse of the existing end process upon expiration.
- Provides reservations and cancellations, reserved seats, and actual entry cannot seize other people's valid reserved seats; reservations are not memberships, and real-time vouchers or reporting qualifications are not granted.
- The user clearly chooses: after the start time, members can enter without waiting for the room host; if the room host is not online 5 minutes after the start, the earliest member of the current online members (the second member) will take over. If the original room host is late, the permissions will not be automatically restored; if no one is online after 5 minutes, it will end directly; after that, as long as the last person exits and the room becomes vacant, it will end immediately without waiting.
- Reuse the existing actual join, identity history, room host management, LiveKit outbox and expiration cleanup to fill the transaction capacity boundary between reservation and join.
- Provides durable, recoverable time scheduling and a unique OpenAPI contract to verify time boundaries, seat competition, cancellation/joining competition and old interface compatibility.

### Confirmed Scope

- The user confirms the basics of reservation first: creation, reservation/cancellation, scheduled opening and end; reminders and no-show restrictions are followed up independently.
- The user confirms that the reservation occupies the actual quota, the number of people must not exceed the capacity, and priority is given to ensuring reservation members; the absence of the room host does not prevent members from entering on time. Later added: If the room is still not present after 5 minutes, the second microphone will automatically take over; if no one is online for 5 minutes, it will end immediately; after 5 minutes, as long as there is no one in the room (the last person exits), it will end immediately, regardless of whether anyone has been online before. If the planned end is earlier, it will end first.
- The planning document is generated this time, and the implementation needs to be applied separately after review. The existing LiveKit/room host management Cloud smoke has not yet been executed and will not be changed to PASS with the reservation plan.

### Proposed Details for Review

- The capacity includes room host, and one reservation seat is reserved for room host when created; other users can reserve the remaining capacity at most. The room host can cancel the entire reserved room before it starts, and cannot still commit to the room host qualification after releasing its reserved seats alone.
- Unused reservation seats are kept until active cancellation, room cancellation or end, and no unconfirmed late release period is set. When joining successfully, the reservation will be atomically consumed; after leaving/removing, the actual quota will be released according to the existing rules. Re-entry will not automatically restore the reservation priority.
- New reservations are only accepted before opening; unused reservations can still be canceled after opening. Reservation is not an automatic check-in. Actual joining requires re-verification of account, rules, password and room status.
- No rescheduling is available this time; if adjustments are needed, cancel the unstarted room and then create a new one. The start/end time uses a timestamp with a time zone, requiring the start to be later than the server time at the time of creation and the end to be later than the start; do not introduce unauthorized days in advance, duration or cross-room overlap restrictions.

### Non-goals

- No reminder channels, push/emails, countdown broadcasts, no-show counting/penalty, reservation creation disabled, standby or automatic release of reservation seats late. The first arrival timeout of 5 minutes and the immediate end of vacancy after 5 minutes belong to this basic room management, without any no-shows or penalties.
- No rescheduling, time extension, number of rooms per person/cross-room conflict limits, room history interface, friends, front-end/Figma or production deployment.
- Do not repeatedly create LiveKit adapter, media room, room host management service, report qualification form or second set of API contract.

### Future Roadmap

- Appointment reminders and no-show rules are proposed to be changed respectively; the historical U-021 reminder channel is still pending, and the historical U-029 placeholder relationship will be entered into the proposal according to this clear selection.
- Press the confirmed Figma on the front end to access the reservation status, personal reservation and actual joining process, and then complete the equipment and product acceptance.

### Unresolved Decisions

- Seat occupation, members entering the room first, taking over in 5 minutes, and ending when no one is online after 5 minutes have all been confirmed, and there is no problem with blocking planning. The Proposed Details listed above are reviewed together with the proposal and cannot be regarded as implemented facts.

## Capabilities

### New Capabilities

- `appointment-rooms`: Reservation room time status, space reservation, cancellation, actual room check-in priority guarantee, room host first absence and recovery scheduling back-end behavior.

### Modified Capabilities

None. The approved requirements for instant rooms remain unchanged; reservations are used as new capabilities to reuse approved sessions, actual membership, room host management and reporting rules, and do not rewrite the delta of other active changes.

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Mainly affects the schema, transaction capacity, join/details/list boundaries and reservation entries of rooms, as well as the scheduling access of existing voice/queue runner.
- Room adds kind and SCHEDULED/CANCELLED status, independent reservation model; historical Room backfill INSTANT, reservation record cannot be disguised as membership.
- The new appointment API maintains boundaries with the existing instant API; existing instant creation and default lists are not mixed with open appointments. NestJS code-first generates `openapi/openapi.yaml`.
- Current HEAD `2687b1a30c90ee1b4abe5a768e28822153922b04`, pre-delivery in unsubmitted workspace: Security report 17/17, finally 196 local tests passed; the workspace evidence needs to be re-verified before applying.
