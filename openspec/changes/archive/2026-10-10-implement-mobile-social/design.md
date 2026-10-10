## Context

OpenAPI already has friend list/request, block list, available users, personal room invitation and rejection interfaces. The friend request response originally only had the user ID, which could not allow the recipient to identify the other party; this change adds the current public nickname to the list of my pending requests, and can display a stable short ID when it is empty. The room host has the `RoomControls` path to send room invitations to people.

## Goals / Non-Goals

**Goals:** Personal relationship list, initiating and processing requests, blocking/unblocking, invitation acceptance and rejection, temporary availability status.

**Non-Goals:** does not add direct chat; does not display precise online time or room activities; does not bypass password, capacity or qualification verification with invitations; does not infer whether the other party has blocked the user.

## Decisions

1. The page is divided into friends/available users/requests/blocking/room invitations, all with independent server cursors. The command is not optimistic and declares success. After success, the related list is refreshed.
2. Each action binds the operation to `clientRequestId` of the target; the uncertain result is inherited when the same operation is retried, and the identification is rebuilt when the target or action changes.
3. Only the server-side `isAvailable` Boolean value is displayed for available users; my heartbeat is only renewed at the server-side recommended interval when the social page is active in the foreground, and stops when leaving/background. The server continues the final decision.
4. Room invitations offer only “View room” and “Decline”. Joining still follows the existing detail and preparation steps; declining includes an idempotency identifier.
5. Visually follows the V2 page and theme tokens, 390×844 fixture screenshot verification, does not claim independent design draft 1:1.

## Risks / Trade-offs

- [Requesting the other party's information and then removing it] → Display a stable short ID when the list nickname is empty, and do not reveal the internal account status.
- [Online coordination failure] → The page explanation is unavailable and the old data is not regarded as real-time status.
- [Command response lost] → Same action is retried using the same UUID.

## Migration Plan

No database/API migration involved. Static inspection, behavioral testing, web viewport and native device evidence are logged separately.
