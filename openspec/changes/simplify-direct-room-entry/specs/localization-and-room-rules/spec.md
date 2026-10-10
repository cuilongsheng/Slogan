## REMOVED Requirements

### Requirement: Confirm safety rules before entering the room

**Reason**: The user explicitly requests to cancel the intermediate steps of entering the room. You can join the ordinary room by clicking on it, and you are no longer forced to enter the independent rule confirmation page.

**Migration**: Direct room entry operation using direct-room-entry. Compatible with the existing rulesAccepted field to indicate the intention to enter the room, and does not pretend to read verbatim; membership will not be established when the user only browses but does not click to join. The existing room rules entrance and Chinese and English content are retained.
