# Keyword and personal vocabulary acceptance after the mobile phone meeting

2026-09-28, the local implementation corresponds to `implement-mobile-post-room-learning`.

## Implementation and Behavior

- Only the rooms in the history list that have ended and that I actually participated in will display the post-meeting keyword entry. The page reads the `DISABLED/PENDING/READY/UNAVAILABLE` status from the API authorized by me; only `READY` displays keywords and short expressions, and does not display audio, transcription or member information.
- The user clicks "Add to my vocabulary" item by item. When a network failure occurs for the same entry, keep `clientRequestId` and try again; after success, the current page shows that it has been added. The backend establishes unique constraints with the user based on source entries. Repeated entry into the page and then importing will return the existing private entries.
- Add "My Vocabulary" to the personal page; the list uses server-side paging, type and collection filtering. Editing display text/personal remarks, switching favorites and confirming deletion all carry `expectedVersion`; 409 retains the draft and requires the user to actively load the latest list.

## Local verification

- `pnpm --filter @slogan/mobile lint`, `typecheck`: Passed.
- `pnpm --filter @slogan/mobile test`: 35 suites, 97 tests passed; API parameters and versions are covered, `PENDING` does not display the import, the same entry network retry idempotent, editing conflicts retain input and filter reset.
- `pnpm --filter @slogan/mobile exec expo export --platform ios --output-dir dist-ios`: Passed, only proving that the iOS JS bundle can be exported.
- `pnpm exec playwright test tests/e2e/mobile-learning-visual.e2e.spec.ts --reporter=line`: 390×844 fixture 1/1 passed, covering historical entry, summary import, personal vocabulary and collection.
- `openspec validate implement-mobile-post-room-learning --strict`: Passed.

![Post-meeting keywords 390×844](assets/mobile-keywords-390-visual-fixture.png)

![Personal vocabulary 390×844](assets/mobile-vocabulary-390-visual-fixture.png)

## Evidence Boundary

The user is allowed to continue using the V2 design language. There are no independent Figma frames on these two pages, so the screenshots only prove the page layout and interaction, not a 1:1 frame-by-frame comparison. Playwright uses deterministic API fixtures; real account room generation, LiveKit Cloud/STT provider and native device acceptance still to be completed. The real provider smoke of the keyword backend change after the meeting is still marked BLOCKED, and the local fixture cannot be regarded as evidence of successful generation.
