## Context

See [proposal.md](./proposal.md) for motivation and split scope. The current code only has instant room create/list/detail/join, Room row lock and unique membership; `implement-livekit-voice-session-backend` is still an unimplemented plan. Therefore, the following provider, presence, event/outbox and end process are pre-delivery requirements and are not capabilities that the current code already has.

This change belongs to Level 2: involves room host permissions, member authorization status, old tokens and concurrent handover. The demand comes from two deltas of current `host-controls`, `voice-session`, `basic-safety-reporting` and this change. It does not rewrite the main specs, and it still needs to be independently implemented and verified after the planning is completed.

## Goals / Non-Goals

**Goals:** uses PostgreSQL as the source of truth and reuses the LiveKit foundation to form retryable member exit, removal, invitation, room host handover, 60-second recovery and active end closed loop; clarify the difference between authorization taking effect and provider cleanup completion.

**Non-Goals:** does not create another provider or queue; does not introduce SDK in domain; does not add independent management services; does not replace real revocation and device evidence with local fake provider testing.

## Decisions

### 1. Pre-dependency and module ownership

Strictly implement [LiveKit change](../implement-livekit-voice-session-backend/design.md) first. Verify the actual public application API, provider revoke/list/delete, signature/idempotent presence, RoomEvent, RealtimeCommand, identity history, BullMQ, and public endpoints in its acceptance record before starting this change. The missing items are resolved by returning to the preceding change, and parallel implementations are not created in this change; this restriction is inherited when Cloud smoke BLOCKED is preceded, and the old token boundary cannot be claimed to pass.

`rooms` application/domain has members with room host rules, transactions, and management HTTP. `voice` receives the trusted presence event and calls the rooms public API, executing host-timeout and provider commands in the original worker; rooms does not import the voice internal service and does not form a loop. Reusing real existing infrastructure is better than a second set of host-control adapters or sharing global business services.

### 2. Member lifecycle and independent migration

Add `ACTIVE/LEFT/REMOVED/INVITED`, `leftAt`, `removedAt` and optional normalization reason to pre-membership; existing row backfill is ACTIVE, retain `(roomId,userId)`, joinOrder, provider identity history and foreign keys. Room adds `hostDisconnectedAt`, `hostReconnectDeadline` and independent `hostReconnectVersion`; general `stateVersion` inherits the prefix field.

The independent reconnect version only changes with the room host identity or disconnection window to prevent ordinary member actions from invalidating still valid timeout tasks. Remaining state conflicts still use Room row lock/stateVersion; no RoomEvent/RealtimeCommand tables copied or lookahead migrations.

- ACTIVE occupies capacity and can be issued a certificate when the authorization conditions are met. It remains ACTIVE when the network is disconnected.
- Ordinary members explicitly leave to LEFT, release capacity, invalidate the old credential version, and atomically append the old identity revocation command.
- LEFT re-entry must pass the account, rule, password, room and capacity verification again, and be assigned the maximum joinOrder plus one in the history of the whole room and a new identity/version.
- Room host removes the target and then changes to REMOVED; the removed person cannot join or issue tokens by himself.
- The room host re-invites REMOVED members to INVITED; the account number, room status and capacity are verified when inviting and when actually joining, and seats are not reserved for invitations. The re-invitation does not bypass the existing platform restriction judgment, nor does it implement the safety officer penalty system here.
- INVITED successfully joins to ACTIVE, assigns new identity and last joinOrder. The retry revocation of the historical identity only applies to the original identity and cannot affect the new session.

The current list, details and capacity are unified and only count ACTIVE; member projections are sorted by joinOrder. After leaving, the sequence number is moved forward but the historical order is not rewritten. Presence and qualification are separated. Abnormal disconnection is not equivalent to voluntary leaving. Deleting the membership and re-creating it will lose the removal chain and audit, so keep the original line.

### 3. room host management authorization, idempotent and concurrency

Lock Room for each management transaction and read the current hostUserId/role and ACTIVE membership of the actor from the database; do not trust the room host identity in client claims or old tokens. The target must belong to the same room, and it is prohibited to bypass the room host exit process by removing yourself. The end/expired status rejects new management actions, and the account's continued use has a public eligibility boundary.

Active leave, remove, invite, transfer, host end and join/expiry share the Room lock to ensure unique room host and capacity. Repeated actions are based on actor, target lifecycle/credential generation, room version and existing command identification, and return submitted results or stable conflicts; old removals cannot be replayed for new sessions after re-entry, and old transfers must not be replayed for new room hosts. The results of an old command submitted can be returned to the original actor, but new administrative rights cannot be granted accordingly.

Manage mutation, RoomEvent, and RealtimeCommand atomic commits. Events retain actor, target, reason, time, result/source, failed/rejected actions record normalized results; do not record raw webhook, JWT, secret or irrelevant personal information. The database immediately closes the removed person's qualification, and the provider's first try/retry uses the front dispatcher; failure returns stable `REALTIME_PROVIDER_UNAVAILABLE` and submitted operation status, and does not misreport "qualification revoked" as "connection disconnected". Retrying the same action must not repeatedly write successful audits or commands.

### 4. Active departure, designation and default takeover

`POST /v1/rooms/{roomId}/leave` Ordinary members do not accept designated successors; room host can pass `successorMembershipId`. In the same transaction, check that the target is the current room ACTIVE, connected and not yourself. If the specified target is invalid, `ROOM_SUCCESSOR_INVALID` will be returned. The original room host remains unchanged and the default successor will be used instead of silently.

If not specified, select the smallest joinOrder (default second MAC) from the currently online ACTIVE members except the original room host; if all candidates have left/disconnected, the public end entry will be called. When the transfer is successful, the hostUserId and roles of both parties are atomically updated, and the original room host is LEFT, and the old room host disconnection window is cleared; concurrent candidates leave, remove, host timeout or expiry must be serialized and re-verified, and two room hosts cannot be generated at any time.

Reuse the pre-member list for subsequent UI to obtain candidates. This change only provides data and verification and does not create a selector UI.

### 5. 60 second window, pause join and resume

Connect the room host disconnection judgment to the presence transaction that has been verified, deduplicated, and processed according to the session/event time; persistently receiving events and setting deadline/audit/scheduling commands are completed atomically to avoid the missed window of "process crash after the event mark has been processed". The original webhook claimed that active leave is invalid, and active exit can only come from authenticated HTTP.

After the current room host is disconnected abnormally, write `hostReconnectDeadline=trustedDisconnectEventTime+60s`, increment `hostReconnectVersion`, and submit a legal and deterministic job ID containing room ID/version to the existing queue; when the event is obviously expired, the account will be reconciled immediately and executed according to the existing deadline, and 60 seconds will not be re-gifted. Only on-time recovery of the current room host and current identity/session can clear the window and invalidate the old timer. Late left does not open a new window, late joined does not take back the room host from the transferred state.

ACTIVE members in the window can continue to communicate/restore tokens; new users, LEFT and INVITED joins and return `ROOM_HOST_RECONNECTING` and `retryAt`, without creating qualifications or placeholders. The current ACTIVE duplicate join is still idempotent. When the deadline has passed but the job has not yet been run, the joining path first requires window settlement or continues to return stable retry results. You cannot bypass the unfinished takeover just because the time has expired.

The host-timeout job re-locks the room and checks the expected host, identity, reconnect version and database deadline; if it is restored on time/has been handed over/has ended, it will be no-op. If it still times out, press online joinOrder to hand over or end it. Priority ends when `endsAt` is reached and no longer takes over. When the Webhook is completely lost, the same rules are filled in by the trusted observation of the front provider reconciliation, and we cannot claim to know the unobserved disconnection time out of thin air.

Startup and periodic reconciliation are missing host-timeout from the database, and Redis data loss does not change the authorization fact. Redis/provider failure can be delayed, and queue lag and pending are recorded; without early transfer, new joins cannot be suspended indefinitely without arranging recovery tasks.

### 6. Actively end the boundary with the old certificate

`POST /v1/rooms/{roomId}/end` After verifying the current room host, call the public end transaction of LiveKit change, and record the actor and active end reasons. This entry will be called even if there is no successor and no candidate for reconnection timeout; the expiration trigger is still owned by the preceding change, and a second expiry worker will not be added.

Shared `OPEN -> ENDING -> ENDED`: The database first rejects the join/token, reuses the identity history and revokes all the unrevoked identities, and ends after DeleteRoom is completed. Each revoke uses the correct old identity and cutoff during execution. The new identity assigned after being invited will not be affected by provider retries; the provider room must not be re-created after retrying at the end of the process. True revocation and offline token rejection must have Cloud evidence, TTL or DeleteRoom success alone is not enough proof.

### 7. HTTP and error contracts

All new entries use user Bearer authentication:

| Endpoint                                                     | Request/Results and Verification                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `POST /v1/rooms/{roomId}/leave`                              | optional successorMembershipId; returns exit, takeover or end status and provider execution result |
| `POST /v1/rooms/{roomId}/members/{membershipId}/removals`    | The current room host removes the current target and returns to lifecycle/operation status         |
| `POST /v1/rooms/{roomId}/members/{membershipId}/invitations` | The current room host is re-qualified to join and no capacity is reserved.                         |
| `POST /v1/rooms/{roomId}/end`                                | The current room host initiates a public end, and the response distinguishes ENDING and ENDED.     |

Expand the existing memberships join, members query and realtime-credentials authorization without repeatedly creating endpoints. The HTTP DTO carries the target version required to prevent deferred management requests from being made to the new generation, and writes committed results/conflict semantics to the generation contract. Stable errors are at least `ROOM_HOST_REQUIRED`, `ROOM_MEMBER_NOT_ACTIVE`, `ROOM_INVITATION_REQUIRED`, `ROOM_SUCCESSOR_INVALID`, `ROOM_HOST_RECONNECTING`, reusing existing membership, capacity, end and provider unavailable errors.

NestJS code-first decorator/DTO deterministically generates `openapi/openapi.yaml`; verifies 401/403, cross-room target, old room host direct request, invalid successor, timeout/expiration conflict and provider pending, does not retain the second handwritten contract.

### 8. Acceptance coverage and split handover

| Requirements/scenarios                                                                  | Observable evidence of this change                                                                         |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Room host removal/reinvitation, restrictions cannot be bypassed                         | Permission E2E, concurrent capacity test, removal of old token rejection and new identity re-entry smoke   |
| designated/default successor, no successor                                              | Room row lock integration test, unique host/role consistency, public end call                              |
| The wheat position moves forward and returns to the last position.                      | repository/member DTO and join/leave E2E                                                                   |
| 60 seconds to resume, timeout to take over or end                                       | frozen clock, out of order/lost webhook, real Redis job/restart, boundary race                             |
| There is already a session in the window that is continued and a new session is paused. | HTTP test for ACTIVE recovery and new user/LEFT/INVITED rejection; subsequent acceptance of device audio   |
| Room host actively terminates and expires competition                                   | Reuse end path, all old identities revoked, no duplicate expiry workers                                    |
| Key event audit and server authentication                                               | actor/target/result audit assertions, non-room host/old room host/cross-room requests do not change status |

Finally records the respective status of local testing, real provider smoke, and future product acceptance. The front revoke adapter smoke does not replace this "remove → block → reinvite → new session" service smoke. Without isolation Cloud credentials, the provider item remains BLOCKED; the current code has not changed, and the planning verification cannot be written to pass the above test.

## Risks / Trade-offs

- [Risk] Dependencies have not been implemented yet → The first task is to verify LiveKit delivery and do not modify the same underlying capabilities in parallel; maintain the dependency order of these two changes.
- [Risk] Ordinary member operations accidentally cancel the disconnection task → independent hostReconnectVersion, row lock and start upscheduling, and test the member leave/remove and timeout competition in the window.
- [Risk] Old webhook or old management request affects new session → preset session water level, current identity/version verification; management request binds target generation.
- [Risk] provider has failed but the database has been submitted → qualification is closed first, durable command is compensated, pending/unavailable is returned, and finally disconnected after recovery is verified.
- [Risk] Concurrent handover, exit and expiration conflicts → Same Room lock, end priority, no side effects for repeated/expired tasks.
- [Trade-off] Independent change adds a migration and handover → in exchange for clear ownership; the implemented LiveKit migration must not be rewritten or its schema copied.

## Migration Plan

1. Add membership lifecycle, exit/remove fields and hostReconnect deadline/version to the database implemented by front-end LiveKit; maintain Prisma with a single model file, backfill ACTIVE and retain the existing identity history, commands, joinOrder and foreign keys.
2. Verify the complete upgrade chain of the empty library, as well as the upgrade fixture including connected members, ENDING room, historical identity, and pending command. Update list/details/capacity query to ensure that old data is not lost and inactive no longer takes up space.
3. Migrate before deploying to the same compatible version of rooms lifecycle, management API, window authorization check and worker; do not release full product until controlled integration verification is completed. The old version does not understand REMOVED/INVITED or window semantics, and is prohibited from receiving join/token mixed with the new version.
4. Perform local verification, isolate Cloud management service smoke and runtime recovery check, record release state as not deployed, unless there is evidence of actual release.

To roll back, you must first close the new joining/certification and management portal, complete the activity provider session revocation/end, and then return to the previous version; you cannot return to the old application that does not understand REMOVED and continue to issue external certificates. Keep the authorization closed when the provider is unavailable and reserve the compensation worker, waiting for recovery or forward fix. The database retains the history of new fields, RoomEvent and command, and does not perform destructive down migration; migration recovery drill verification restrictions will not be lost.
