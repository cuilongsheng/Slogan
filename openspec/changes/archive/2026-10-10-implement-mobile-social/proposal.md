## Why

Friends, blocking, temporary availability and personal room invitations already have backends and OpenAPI, but the mobile version currently only uses part of the candidate list in room host management operations, and ordinary users cannot manage relationships or process received invitations.

## What Changes

- The personal page provides access to friends, inviteable users, friend requests, blocks, and received room invitations.
- Using personal authorization and server-side paging, social commands retain UUIDs that can be safely retried.
- The invitation received enters the existing room details/preparation process. Rejecting the operation does not bypass the room qualification.
- User allows pages without independent high-fidelity frames to inherit V2 styles.

## Capabilities

### New Capabilities

- `mobile-social`: Mobile phone relationship and room invitation processing.

### Modified Capabilities

- `friend-relationships`: Add the other party’s current public nickname (can be empty) to my pending friend request list so that the recipient can identify the request; the relationship or visibility range is not expanded.

## Impact

`apps/mobile` personal portal, social routing/feature, copywriting, testing and acceptance records; `apps/api` minimum display field for friend request, OpenAPI and generated client. Do not change backend relationship permissions.
