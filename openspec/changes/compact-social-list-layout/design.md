## Target

Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766`, original frame `217:3386` / 02 UI / Partners / Available · V2, 390x844. Selection ancestry identified the latest edited frame; older similarly named frames `186:2348` and `186:2369` are not the new list visual authority. The owner explicitly applies this Partners reference to both Partners and Messages.

## Decisions

- Reuse PeerRow for both screens with transparent background, 61px row, margins16/24, bottom divider1, avatar42, name12/21 bold, detail12/18 regular, text gap4, icon button34 with existing exact20px white chat asset. Keep real provider avatars; a missing or failed avatar shows the styled display-name initial from the reference.
- Preserve generated API calls, polling, cursor pagination, unread context and navigation. Conversation copy remains the actual latest message or call preview. Long press still opens the existing hide-history dialog. No fake repeated Luna rows or invented availability are introduced.
- Keep a full-row accessible touch target; the 34px visual icon is inside the 61px actionable row. Unread count badges remain visible and announced by the existing accessibility label, with bounded count and clear contrast.
- Remove the Partners availability subtitle. Both lists use the reference's 16px centered title and compact shared header/list spacing. On web, compensate only the existing simulated system-chrome height; native titles stay below safe-area chrome.
- Add optional title styles with unchanged defaults for other headings. The owner additionally requested checking the edited bottom bar: apply its shared 61px height, icons24 at y8, labels11/16 at y36, white background, no top border or selection circles, active #6247E8, inactive label/Discover icon #787587 and other inactive icons #B2ADBE across all four main tabs. Keep evenly distributed touch targets rather than reproducing manually uneven tab positions in the draft; badge and navigation behavior remain unchanged.
- Empty-refresh, initial loading, actionable error, long names, real avatars and unread states retain existing behavior. No backend/API contract changes.

## Risks and Rollback

Fallback avatar state must reset when the URL changes. Truncate name and preview to available width; do not allow long messages to grow rows. Optional title styles must not change Discover/Me headings. The shared footer intentionally updates all main pages so switching tabs keeps the same height. Restore prior title, PeerRow and BottomNavigation styles to roll back; no data, provider or signing migration.

## Evidence

Original measurements and image capture are recorded now; source review covers only changed rendering and unchanged callbacks. Final lint/types/tests/build, two routed list captures and Android visual comparison are deferred. Do not report 1:1 runtime acceptance from a Figma screenshot alone.
