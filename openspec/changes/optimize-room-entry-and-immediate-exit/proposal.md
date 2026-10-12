## Why

The owner explicitly requested faster creation/admission and immediate local return to discovery on leave/end on 2026-10-12. Current admission repeats detail reads and LiveKit provisioning round trips. Ending still awaits provider cleanup and displays a terminal screen. Implementation is authorized by the direct request.

## What Changes

- Reuse fresh account-bound creation responses and admit ordinary joins directly through the existing membership endpoint.
- Display the admitted room while audio connects; fetch member display data concurrently with credentials and media preparation.
- Remove redundant provisioning reads while retaining reservation, final authorization and room-generation checks.
- Return locally to discovery immediately after explicit leave/end intent, using the existing joining-order successor default and validating designated successors.
- Keep exit intent in an account-bound persisted client queue; retries do not require the room screen and never claim server completion early.
- Commit host end operations before provider I/O and let existing durable cleanup recovery run asynchronously.

## Capabilities

### Modified Capabilities

- `host-controls`: one-action exit without a mandatory successor selector; atomic designated/default handoff remains.
- `direct-room-entry`: streamlined admission and immediate local exit with reliable background delivery.

## Impact

Mobile session/navigation/exit persistence, voice credential preparation, LiveKit adapter and host-end delivery. No new provider, account permissions or destructive schema migration. Existing API shapes remain unless generated annotations change.
