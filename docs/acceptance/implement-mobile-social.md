# Mobile friend and invitation acceptance

2026-09-28, the local implementation corresponds to `implement-mobile-social`.

## Implementation and Behavior

- `/me/social` provides six paginated lists of friends, inviteable users, friend requests received/sent, blocked users and room invitations received.
- The friend request list backend supplements the other party's current public nickname; the persistence layer explicitly selects the public response fields to prevent the leakage of fields such as Prisma relationship objects and birth dates. The exact set of E2E validation response fields is not readable by other users.
- Initiating/accepting/rejecting/withdrawing friend requests, deleting friends, blocking/dismissing and rejecting room invitations all use UUID command identifiers; retrying the same action with uncertain results will use the same identifier. My online heartbeat is only renewed at intervals recommended by the server when the page is visible in the foreground.
- Invite "view room" into the existing details and join preparation process, `invitationId` is passed along with the preparation draft to the membership request. Password, capacity, rules and qualifications are still re-verified by the backend.

## Local verification

- API lint/typecheck/OpenAPI check and build client check: passed. `test/e2e/social.e2e.spec.ts` 5/5 passed, covering the minimum field of public nickname, relationship isolation and invitation to join verification.
- Mobile lint/typecheck: passed; 37 suites, 101 tests passed, covering the social authorization API, the same request ID for failed retries, and the invitation ID is ready to be passed after joining.
- iOS JS export passed, only proving that the bundle can be exported.
- `tests/e2e/mobile-social-visual.e2e.spec.ts` 390×844 browser fixture 1/1, through personal entrance, friends/invitable/request nickname/received invitation and room jump.
- `openspec validate implement-mobile-social --strict`: Passed.

![Friend page 390×844](assets/mobile-social-friends-390-visual-fixture.png)

![Invitation page 390×844](assets/mobile-social-invitations-390-visual-fixture.png)

## Evidence Boundary

Users are allowed to follow the V2 style. These pages do not have independent Figma frames, and the screenshots are not compared frame by frame 1:1. Page fixtures and backend E2E do not replace two real accounts, real online collaboration, native devices and push notification acceptance. The online status is only a short-term Boolean projection on the server side, and the page does not display precise time or room activity.
