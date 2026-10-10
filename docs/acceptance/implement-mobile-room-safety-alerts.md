# implement-mobile-room-safety-alerts acceptance record

## Goals and Vision

- Date: 2026-09-30. Local implementation, not yet deployed or completed physical device acceptance.
- Figma Desktop Bridge is connected to `Slogan / 02 UI`, original voice room V2 node `115:1425`, 390×844. The original contains a dark purple background, dark room rule bars and light bottom pop-up language, but there is no security reminder status. Implemented placing the room host reminder entrance after the rule bar, and the pop-up layer uses V2 rounded corners, light surface and purple emphasis; this is a clear new state and does not claim to be from the original pixel by pixel.
- Local 390×844 Web component fixture screenshot: `test-results/mobile-room-safety-alerts-390-visual-fixture.png`. The screenshot shows two minimal reminders and manual verification of copywriting. Temporary preview route was deleted after screenshot, fixture does not prove real backend or LiveKit delivery.

## Contracts and Conduct

- HTTP: `GET /v1/rooms/{roomId}/safety-alerts`, using `@slogan/api-client` generation type, Bearer authentication, `limit=20` and `cursor`; only the current room host can be authorized by the server.
- Real-time: only treat data packets with matching topic `slogan.room-safety-alert.v1`, `version=1`, `type=ROOM_SAFETY_ALERT` and roomId as refresh signals. Unknown versions and error rooms are ignored; display data only takes the HTTP list.
- Query after the active room host enters the room, periodically refreshes the room, and reconnects with LiveKit; clears the reminder when the room host is disqualified, leaves the room, ends, reconnects, and the query is rejected by 403. Asynchronous requests are isolated by generation, and the old room host results will not be backfilled. Ordinary members and unactivated rooms are not queried or displayed.
- The page only displays the controlled category, severity, relevant members, time, frequency and "manual verification"; there is no voice/transcription/hit of the original text, and no automatic punishment.

## Local verification

| Check                                                                                                     | Result                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @slogan/mobile lint`                                                                       | PASS                                                                                                                                                                                                             |
| `pnpm --filter @slogan/mobile typecheck`                                                                  | PASS                                                                                                                                                                                                             |
| `pnpm --filter @slogan/mobile exec jest --runInBand src/features/voice-room`                              | PASS: 9 suites / 34 tests, including API path, packet filtering, real-time monitoring, room host clearing after takeover, reconnection completion, access denied, old request isolation and elastic layer paging |
| `pnpm --filter @slogan/mobile build`                                                                      | PASS：Expo iOS export                                                                                                                                                                                            |
| `pnpm --filter @slogan/mobile exec expo export --platform web --output-dir /tmp/slogan-mobile-safety-web` | PASS：Expo Web export                                                                                                                                                                                            |
| `openspec validate implement-mobile-room-safety-alerts --strict`                                          | PASS                                                                                                                                                                                                             |
| 390×844 elastic layer visual fixture                                                                      | PASS: The typesetting is readable and there is no overflow; this state is not defined in the original manuscript and cannot be called a 1:1 comparison.                                                          |

## External acceptance not completed yet

- **BLOCKED — Real LiveKit Cloud with qualified streaming STT provider:** There is no smoke that actually triggers the controlled risk in the double room. The verification only sends the current room host, takeover and reconnection. Backend change 9.5 remains pending.
- **BLOCKED — Native device:** The Apple Team/Keychain signing conditions for the current iOS development package have not been resolved, and Google login, two-person voice, directed reminder and takeover testing on supported devices cannot be completed. Backend change 9.6 remains pending.
- Local component fixtures, Jest and export cannot replace service provider and equipment certification; this change will not be archived yet.
