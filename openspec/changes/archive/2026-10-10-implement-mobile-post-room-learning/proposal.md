## Why

The backend has provided post-meeting keyword summary and personal vocabulary API readable by participants, but there is no corresponding entrance on the mobile phone. Users cannot view the generation status, nor can they save and manage learning items independently.

## What Changes

- The room history provides post-meeting keyword entry for ended and actually participated records, showing the `DISABLED/PENDING/READY/UNAVAILABLE` status.
- `READY` is summarized and manually imported into the personal vocabulary book one by one, and the same idempotent identifier is used for repeated requests.
- The personal portal adds a vocabulary list, supports server-side paging, type/favorite filtering, editing text and notes, collection and deletion, and version conflicts are not silently covered.
- No independent high-fidelity frame, follow V2 style according to user confirmation.

## Capabilities

### New Capabilities

- `mobile-post-room-learning`: Post-meeting keyword and personal vocabulary management on the mobile phone.

### Modified Capabilities

None. Only consumes the current OpenAPI; does not modify server generation and permission rules.

## Impact

`apps/mobile` personal entrance, historical entrance, learning feature, routing, copywriting, testing and local visual evidence.
