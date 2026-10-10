# Voice room member operation and reporting acceptance record (2026-09-28)

## Implementation and security boundaries

- Member, removal confirmation, removed member re-invite, friend/available user invitation, room host departure takeover and member reporting overlays retain existing voice sessions.
- The member list only adds `userId` to the current authenticated room members for use by the reporting API; the removed list is only readable by the current room host. Remove and re-invite to submit the member version seen, invite and report to submit the stable request identification, the server continues to review the permissions and status.
- The report category, description and target are submitted to the existing security API; successfully only the acceptance number is displayed and the report content is not broadcast to the room. The form is scrollable in small screen and soft keyboard scenarios.

## Validation and Boundaries

- 23 groups and 72 tests passed on the mobile terminal, covering removal confirmation, reporting failure retry flag and offline friend invitation candidates.
- API 36 groups, 196 integration tests passed; the room host permissions and reinvites of the removed list are verified in the integration and HTTP use cases. Speech HTTP group tests pass after synchronizing member fields expected 6 times.
- A real local Google session is created and enters an instant voice room, reads members, opens invitation candidates and leaves the room host, then ends the test room.
- Dual account removal, reinvitation, reporting, takeover, 390×844 visual screenshots of each overlay and native dual-device LiveKit acceptance have not yet been completed, and it cannot be claimed that all end-to-end passes are currently available.
