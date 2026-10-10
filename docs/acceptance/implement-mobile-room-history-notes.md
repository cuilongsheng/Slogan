# Acceptance of room history and private notes on mobile phone

2026-09-28, the local implementation corresponds to `implement-mobile-room-history-notes`.

## Implementation and Behavior

- `/me` adds a new "room history" entrance; `/me/history` loads from the personal history interface in pages, distinguishes between participated and reserved only, and displays status, type, CEFR and time.
- Only records that have participated and the room has ended show the note entry; `/me/history/[roomId]` reads private notes through the personal token.
- Save and clear carry `expectedVersion`. 409 conflict. Keep local drafts, disable saving of old versions, and replace drafts only after the user selects "Load latest notes"; network failure does not show saved.

## Local verification

- `pnpm --filter @slogan/mobile lint`, `typecheck`: Passed.
- `pnpm --filter @slogan/mobile test`: 32 suites, 91 tests passed; covering interface requests, participation and reservation distinctions, conflict draft retention, and cleared versions.
- `pnpm --filter @slogan/mobile exec expo export --platform ios --output-dir dist-ios`: Passed, only proving that the iOS JS bundle can be exported.
- `pnpm exec playwright test tests/e2e/mobile-history-visual.e2e.spec.ts --reporter=line`: 390×844 fixture 1/1 passed, covering entrance, only reservation without note entry, note saving version 0→1.
- `openspec validate implement-mobile-room-history-notes --strict`: Passed.

![Room History 390×844](assets/mobile-history-390-visual-fixture.png)

![Private Notes 390×844](assets/mobile-note-390-visual-fixture.png)

## Evidence Boundary

The user agrees to use the V2 design language. This feature does not have independent Figma frames, so the screenshots do not constitute a 1:1 comparison. Playwright uses deterministic API fixtures; real account history and native device acceptance are not yet complete. The final decision on access to other members' notes remains the responsibility of the backend.
