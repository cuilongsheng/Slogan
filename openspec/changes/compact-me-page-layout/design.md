## Target

File `56nIowZmvBhb0QJvOlDQdU`, page `102:2766` / 02 UI, frame `152:1467` / Me / 精简个人中心 · V3, 390x844. Inspect the current original through Desktop Bridge; preserve it. The owner explicitly supersedes the prior Me heading requirement.

## Decisions

- Keep the existing SafeArea/RoomPage shell, authenticated avatar and name, persistent language choice, routed actions and logout. No API contract or backend change.
- Remove MainPageTitle. Place the 52px avatar/name row immediately below system chrome. Match 18/27 bold name, avatar/name gap8 and the source's bottom baseline. Truncate long display names within the available row rather than expanding the screen horizontally.
- Use 14px separation to the language row. Visual controls measure 102x27 and 112x27 with gap8, 14/20 medium text and lavender fill; expand touch hit areas without expanding the visible pills. Reserve the original 42px row height before the first divider.
- Latest owner correction on 2026-10-15 uses the current Desktop Bridge controls: both language pills 80×24, gap 8, 12/20 medium text, 11px below the 27px name. Profile starts at y61 below preview system chrome, while the 52px avatar starts 4px lower at y65. This supersedes the older pill dimensions and spacing above. Existing normalized 46px menu/logout controls and retained reports/update/navigation behavior remain.
- Use 20px menu outer margins and 6px label inset. Rows are 44px with 14/20 medium labels and 1px neutral separators, without filled backgrounds.
- Preserve My reports as required by current product intent and Check for updates from the pending updater feature. Append these after the three illustrated menu entries using the same row style. The absence of these entries or main navigation in a static design does not delete their previously authorized behavior.
- Preserve the shared 342x46 logout geometry and responsive narrow-width behavior; use the latest source's 14px corner radius locally. Preserve bottom navigation. Navigation is a retained product surface; runtime comparison must account for its reserved footer space rather than claiming an exact full-screen match to a design without navigation.

## Risks and Rollback

2026-10-17 owner correction: use the current white profile/card surfaces,41px profile top padding within the123px identity surface,10px section gap, text-inset menu dividers and #F6F7FB language options. Retained My reports and Check for updates also receive original Foundations audit/refresh icons. Language option dimensions remain80×24. The original remains immutable. Restore the37px Web status preview for this screen only; native safe-area chrome remains platform owned. Existing action handlers, main navigation and logout are retained. The owner now authorizes affected checks and device/release acceptance.

Small visible language controls need larger hit areas. Long names and English menu labels need bounded rows. Additional retained entries require scrolling on short screens; logout remains outside the scrolling list. Reverting MeScreen styles restores the previous layout; no data migration, provider or credential change.

## Evidence

Original Figma measurements/capture and source review are recorded now. Affected checks, runtime/physical Android captures and source-to-runtime comparison remain deferred at the owner's request. No visual PASS or deployed claim until those checks run.
