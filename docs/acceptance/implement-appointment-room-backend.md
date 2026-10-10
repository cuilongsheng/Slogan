# Room reservation back-end acceptance record

## Range and Baseline

2026-09-13, based on the current uncommitted workspace implementation. The six-stage migration of front-end identity information, instant room, LiveKit, room host management and reporting backend are all retained; the existing security reporting acceptance baseline is 196 local tests, which are not considered as verification results of the new implementation this time.

User confirmation: Reserve a seat; arriving members can enter first; if no one is online for 5 minutes, it will end immediately. If there are online members and the room host has never arrived, the earliest online member will take over; after that, the last person exits or the room host is trusted to be disconnected, leaving the room empty, and it will end immediately. Cancel the 10-minute rule and no penalty for no-shows.

## Implementation and Evidence

- Six reservation APIs: creation, paging list, personal details, reservation, cancellation of reservation, room host cancellation before starting. Reservation only projects my id/status/version and does not return the password summary or other people's reservation list.
- The creator reserves a seat but no membership; actually joining the same transaction consumes BOOKED. Normal join, re-entry and invite capacity checks protect unused reservations. Failed requests do not consume seats.
- Shared RoomLifecycle and row lock context are used for reservation, join, real-time issuance, event and room host management; expiration and vacancy end are still submitted after rejecting the request, and the end fact cannot be rolled back due to a business error being thrown.
- Use the existing RealtimeQueue, add start and 5-minute checks; Redis lost tasks are recovered by database scan. REALTIME_ENABLED=false does not disable reservation time rules.
- The room is still vacant after 5 minutes and does not wait for takeover; the room host has arrived and cannot cancel the vacancy check. The existing 60 second disconnection window only retains its effect while there are still members online.
- The identity has been issued or the media room has been created. ENDING/revoke/delete; when there is no identity history and no provider SID, you can directly ENDED to avoid creating a media room for the end.

### Directional evidence

- `test/integration/appointments.spec.ts`: Real PostgreSQL seat competition, version replay, cancellation, actual joining, takeover, vacancy end, provider failure and real Redis lost task recovery.
- `test/unit/appointment-lifecycle.spec.ts`: Start, 5 minutes, 1 millisecond before and after the end of the plan and vacancy after arrival, identity clearing issued.
- `test/e2e/appointments.e2e.spec.ts`: Real authentication HTTP six entries, password, privacy, illegal time, and only making an appointment cannot be qualified for reporting (remember the REPORT_CONTEXT_NOT_FOUND privacy boundary).
- `test/integration/appointment-migration.spec.ts`: Isolate empty schema from historical data upgrades containing OPEN/ENDING/ENDED, ACTIVE/LEFT/REMOVED, old Room backfill INSTANT, reservation version constraints and RESTRICT deletion constraints.

## Migration and rollback

Add `20260913000000_appointment_rooms` without rewriting the first six migration segments. Added RoomKind, two states, first room host mark and RoomReservation; historical rooms default to INSTANT. The complete seven-segment migration was successfully applied to the isolated test database.

Release must allow join/appointment/worker that understands reservation space to be deployed in the same batch. Old versions must not receive reservation room join requests in parallel. When rolling back, first close the reservation entrance and reservation join/token, cancel unstarted rooms, and end open sessions; retain newly added table columns and historical data, and do not perform destructive down migration. Keep the compensation worker when the media fails, and give priority to forward repair. No production release or rollback performed.

## Verification status

Final `pnpm verify:api` PASS: 102 unit tests, 81 integration tests, 46 HTTP E2E, a total of 229; lint, typecheck, build, and OpenAPI drift all passed. `pnpm format:check`, `pnpm deps:check` (180 modules / 583 dependencies) passed strict verification with OpenSpec. The directed test fixture had fixes for ESM mock references, historical participantIdentity required values, and reporting error formats; these are not considered product behavior changes.

## Unfinished boundary

LiveKit Cloud configuration not provided, retaining real media at user discretion verification not completed. Google/WeChat provider verification still uses prefix records. Front-end, dual-device real voice, network disconnection recognition delay, product acceptance and production deployment are not completed, PASS will not be recorded.

"Online" comes from a trusted presence with a valid identity/session; actual network disconnection requires provider observation for delivery. End of immediate revocation of new platform qualifications, media disconnection still relies on asynchronous provider cleanup; local fake-provider verification must not be described as real audio or Cloud verification passed.
