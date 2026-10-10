## Context

`safety-restriction-appeals` master specification and two existing personal APIs have defined fields, 30 minute window, one appeal and idempotent rules. Mobile Expo Router, AuthProvider, OpenAPI generated client and V2 `RoomPage`/tokens can be reused. Confirmed V2 visual language is inherited when user confirms missing independent Figma frames.

## Goals / Non-Goals

**Goals:** Reachable personal page, real list and appeal, stable error/retry status.

**Non-Goals:** does not expand the number of appeals or windows, does not display background evidence, does not add permanent disabling appeals, and does not modify background processing rules.

## Decisions

1. The personal entrance is entered through the "My" navigation at the bottom of the room list; the personal page first accommodates restricted entrances, and subsequent post-meeting recording and friend functions can be accessed separately. The restricted page uses `Gate allow="ELIGIBLE"`, and the temporarily restricted account remains logged in and accessible.
2. The API feature only consumes the `packages/api-client` type and is called using an existing `authorized` session. Refreshing the first page resets the cursor; failing to retain the loaded records on the next page.
3. The submission ID is generated when the form is entered for the first time; if the network fails for the same reason and is retried, the ID will be used. Change the ID after modifying the reason. The client clock only controls the entry prompt, and the server is the final arbiter of the window. Refresh the list when an error occurs; the existing appeal and deadline results are subject to the server.
4. Visually uses V2 warm white background, purple main button, rounded corner information card and 390×844 page rhythm; there is no independent original manuscript, so visual acceptance is based on component consistency and runtime screenshots, and a single page cannot be claimed to be 1:1.

## Risks / Trade-offs

- [The device time is inconsistent with the server time] → Submit qualifications only as a prompt, the server will refresh the list after rejection.
- [Reason for user modification after failure] → The new request identifier avoids idempotent content conflict; the original content is retried to retain the identifier.
- [Excessive display of security information] → Only display the minimum fields of the personal interface, without adding internal processing identifiers or evidence.

## Migration Plan

No data migration or new API. Front-end routing and entry can be rolled back independently. Acceptance includes static inspection, API client behavior test, 390×844 Web runtime and real authenticated API empty state/data state; native device verification is recorded separately and is not replaced by Web.
