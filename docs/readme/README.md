# README image notes

The root project README supports English / Simplified Chinese switching. Both versions use the same English images.

## Runtime screenshots

Captured on October 10, 2026 from the real React Native screen components in `tests/visual-harness`, based on application commit `b828e9a5267bb9481f9675168b0cb8eb24377a0f`. The viewport is 390 × 844 CSS pixels at device scale factor 2.

The documentation capture uses the application's existing English locale. A Vite transform switches only the harness's locale and sample room topic; production source and existing acceptance screenshots remain unchanged. HTTP responses, authentication, media state, and recording are explicit fixtures. The invitation list uses samples rather than live users. Sample portraits reuse the existing visual acceptance assets.

| Image                                                     | Runtime component / state                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Room discovery](images/rooms.png)                        | `RoomListScreen`, four sample rooms; actual API-supported fields only   |
| [Voice room](images/voice-room.png)                       | `VoiceRoomScreen`, host, four participants, six seats, one room message |
| [Room creation](images/create-room.png)                   | `CreateRoomScreen`, three CEFR ranges                                   |
| [Expression assistance](images/expression-assistance.png) | Disabled acceptance button and English development notice               |
| [In-app invitation](images/invite.png)                    | Actual empty-seat action and available-people selection sheet           |
| [Reconnecting](images/reconnecting.png)                   | Actual recovery component with a fixture host deadline                  |

These images are UI documentation, not Android device, production account, LiveKit, or AI-provider acceptance evidence. The admin is currently primarily Chinese and is described in the README without presenting a fabricated English admin screenshot.

On October 11, the expression-assistance image was replaced by the actual disabled component state from application commit 9bc34a6, using the English development notice. The public pilot does not enable recording or consent acceptance through this entry. Other images retain the October 10 provenance above.

To regenerate after installing workspace dependencies:

```bash
nvm use
node docs/readme/capture-screenshots.mjs
```

The capture starts a local server at `localhost:8094`, writes only these six images, and closes the server and browser afterward. Playwright Chromium must be installed (`pnpm exec playwright install chromium`).

## Diagrams

- [Architecture](architecture.svg): hand-authored SVG showing current runtime boundaries and optional providers.
- [Delivery](delivery.svg): hand-authored SVG showing the preview / production distinction and APK release gate.

Diagram labels are English and are shared by both README language versions. They are documentation illustrations, not exports from or replacements for the original Figma designs.
