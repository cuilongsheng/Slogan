# README image notes

Both project README entry points use English text and images.

## Runtime screenshots

Captured on October 10, 2026 from the real React Native screen components in `tests/visual-harness`, based on application commit `b828e9a5267bb9481f9675168b0cb8eb24377a0f`. The viewport is 390 × 844 CSS pixels at device scale factor 2.

The documentation capture uses the application's existing English locale. A Vite transform switches only the harness's locale and sample room topic; production source and existing acceptance screenshots remain unchanged. HTTP responses, authentication, media state, and recording are explicit fixtures. The invitation list and expression result are samples, not live users or an actual AI transcription. Sample portraits reuse the existing visual acceptance assets.

| Image                                                     | Runtime component / state                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Room discovery](images/rooms.png)                        | `RoomListScreen`, four sample rooms; actual API-supported fields only   |
| [Voice room](images/voice-room.png)                       | `VoiceRoomScreen`, host, four participants, six seats, one room message |
| [Room creation](images/create-room.png)                   | `CreateRoomScreen`, three CEFR ranges                                   |
| [Expression assistance](images/expression-assistance.png) | Actual hold / release UI with a fixture response                        |
| [In-app invitation](images/invite.png)                    | Actual empty-seat action and available-people selection sheet           |
| [Reconnecting](images/reconnecting.png)                   | Actual recovery component with a fixture host deadline                  |

These images are UI documentation, not Android device, production account, LiveKit, or AI-provider acceptance evidence. The admin is currently primarily Chinese and is described in the READMEs without presenting a fabricated English admin screenshot.

To regenerate after installing workspace dependencies:

```bash
nvm use
node docs/readme/capture-screenshots.mjs
```

The capture starts a local server at `localhost:8094`, writes only these six images, and closes the server and browser afterward. Playwright Chromium must be installed (`pnpm exec playwright install chromium`).

## Diagrams

- [Architecture](architecture.svg): hand-authored SVG showing current runtime boundaries and optional providers.
- [Delivery](delivery.svg): hand-authored SVG showing the preview / production distinction and APK release gate.

Diagram labels are English and are shared by both language versions. They are documentation illustrations, not exports from or replacements for the original Figma designs.
