## Context

Currently `user-availability`, `room-invitations`, `friend-relationships` and `user-blocking` have defined some social boundaries; the multi-person voice room has independent room and seat rules. The current mobile terminal does not yet have routing for finding partners, private messages and single chat calls. For motivation, see [proposal.md](./proposal.md), and for behavioral boundaries, see the four delta specs of this change.

## Goals / Non-Goals

**Goals:** Use existing accounts, security and availability to determine access partner discovery; allow messages and private calls to have clear persistent/temporary states; retain room business boundaries; provide rollback data and release paths.

**Non-Goals:** Don’t let Figma determine permissions or messaging business rules; don’t turn 1-to-1 calls into fake multi-person rooms; don’t commit to offline push, end-to-end encryption of messages, or multimedia messaging.

## Decisions

### 1. Navigation and design sequence

"Discover" continues to host the room list, the second entrance is changed to "Find a Partner", and the third entrance "Message" has the entry for recent conversations and friends. First complete the low-fidelity process review of finding partners, message lists, text conversations, voice requests/calls, and deletion/blocking feedback in `01 Prototype`; after confirmation, use the existing tokens/components of `00 Foundations` to create key high-fidelity pages in `02 UI`, and then expand the status. Reuses the visual language of existing room cards, but uses lists of companions and conversations that fit the person/message, and does not duplicate the room cards. The alternative is to directly modify the existing high-fidelity navigation; this will solidify the unapproved behavior in the mockup, so it is not used.

### 2. Partner query and action server review

The partner list reuses the qualification, privacy and paging semantics of `user-availability`, allowing short-term caching but not treating the cache as invitation/send/call authorization. Invite to continue to enter the existing `room-invitations` service and re-verify based on the current room host, target and room capacity. Text and voice enter their respective domain services from the same partner information entrance. The alternative is for the client to determine action permissions based on the list; the status will expire and cannot prevent unauthorized access.

### 3. Private messages use the PostgreSQL persistent session model

Added Conversation of unique unordered participant pairs, ascending sorted Message, session visible boundary and read position of each participant. Send the recheck qualification, shielding, idempotent key and write the message and session summary in a single persistent transaction; the client paging through the cursor to retrieve the history, real-time events only prompt new messages, and the server history is used to complete the disconnection. Remove visible boundaries/hidden status of only the advancing operator, retaining visibility history for the other party; new messages allow the conversation to reappear. The permission service ensures that any query is filtered with the current user as the participant. The alternative is to just use Redis/device local logging; cross-login history and unilateral deletion semantics are not guaranteed.

### 4. Voice calls are independent of multi-person Room aggregation

DirectCall has request, acceptance, rejection, timeout, connection, end status and identity of both parties; request and final status are auditable and persistent records, and short-term ringtone/connection coordination can be used with Redis. Call the existing real-time media adapter to issue a short-term certificate for the **Exclusive for both parties** media session. It can only be issued after the transaction is accepted successfully and the qualification is verified again; the third party is not qualified. Active audio occupation and multi-player rooms are mutually exclusive. Ending, blocking or timeout will revoke subsequent access and clear media resources. The alternative is to reuse normal room capacity and invitation status; that would introduce incorrect semantics for hosts, seats, public discovery, etc.

### 5. Security and interface contract

Follow the current API-first path: first change the unique `openapi/openapi.yaml`, then implement NestJS/controller and client type against it, without maintaining the second handwritten contract. All write requests use the existing identity context, stable idempotent identification and unified unavailable error; stranger's first/continuous message configuration rate limit and reporting entrance. The report message reuses the existing security case boundaries and does not expose the report information in the ordinary message response. After the mask is written, both the sending and receiving paths are reviewed and blocked, and the waiting voice requests can no longer be accepted. The alternative is to first define the interface with Figma or front-end mock; there is no guarantee that the security rules and contracts are consistent.

### 6. Session History and Privacy

Deletion is a personal visibility change, and the message cannot be withdrawn for the other party. The message body is retained to satisfy the other party's history and authorized security processing; the retention period and legal deletion request follow the platform data governance mechanism, and "delete from the list" cannot be used to replace formal data deletion. Do not default to recording, transcribing, or stuffing audio content into text history; call lists retain status, time, and minimal events visible to participants at most.

## Risks / Trade-offs

- [Increase in harassment from unfamiliar messages] → Server-side speed limit, blocking and message-level reporting; verify rejection and restricted status on real devices.
- [Shield and send/receive concurrency race conditions] → Recheck when writing and receiving, cooperate with transaction/status version and media qualification short-term invalidation mechanism; covered with concurrency testing.
- [Old history unexpectedly reappears after deletion] → Each person can see the boundary independently, and cursor queries and unread calculations are included in the boundary; cross-device acceptance.
- [Media credentials survive for a short time after the end] → Short-lived credentials, server-side terminal status verification and active disconnection; verify with the real media environment before publishing.
- [New persistent tables and indexes affect migration] → Forward compatible migration, phased enablement and rollback switches; written user messages will not be discarded during rollback.
- [Figma style is finalized before behavior] → The low-fidelity process is reviewed first, and the existing high-fidelity process is only changed after the requirements are confirmed.

## Migration Plan

1. First confirm this proposal and the low-fidelity process, update the unique OpenAPI contract and complete the database forward compatibility migration; old clients continue to use the original room entrance capabilities.
2. Deploy backend partners, private messages, single chat calls and security rules, close new entrances by default; test and verify with contracts, permissions, concurrency and migration.
3. Mobile routing is implemented according to the confirmed Figma low-fidelity and high-fidelity; real operation and equipment evidence acceptance such as shielding, cross-login history, unilateral deletion, voice need to be accepted, room host invitation, etc. are then gradually enabled.
4. When a publishing problem occurs, close the new entrance and new write path, roll back the client/service version; retain the new table and existing messages, and restart after repair, without performing destructive downgrades. The database structure is otherwise migrated using a drilled forward repair.
