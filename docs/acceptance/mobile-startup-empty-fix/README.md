# Mobile startup, compact controls and partner cursor correction

Recorded on 2026-10-15 in `/Users/cls/.codex/worktrees/room-experience-release/Slogan`, client work based on `7ba709b`, integrated with the backend-first `codex/mobile-sse-release` delivery. Existing worktree acceptance/release edits were retained. The current develop checkout does not contain the live Partners/Messages implementation and was not changed.

## Result and scope

- Login already renders **Slogan** in both language dictionaries, matching the original. No artificial spelling change was made.
- AuthProvider now starts before font/language readiness. StartupGate combines restoration/readiness and owns one startup surface. A restore that finishes within 180ms skips the brand; longer restoration shows the existing brand after fonts/language are ready. Completion is never held for a minimum display time. The existing session operations remain unchanged.
- Me matches the current source's name/avatar offset and 80×24 language pills with an 11px gap below the name. Previously authorized My reports, supported Android update action and bottom navigation remain.
- Both successful empty list states use the source's compact 86×30 soft Refresh control. In the measured 390×844 browser shell it is at `(162,335)`; hitSlop increases the touch area to 44px high.
- Partners follows empty API scan pages that still have a cursor. Each batch reads at most ten API pages; it preserves continuation and displays Load more when the budget is reached. It retains traversed page counts for future refresh. This fixes a reproducible false-empty path; it does not establish that every reported production blank has this cause.
- **SSE is implemented locally** under `replace-main-list-polling-with-sse`: one shared authenticated foreground connection invalidates Discover, Partners, Messages and unread snapshots. Its backend/proxy release precedes client publication. See [streaming acceptance](../main-page-sse/README.md) for separate local, cloud and device evidence. The cursor correction remains independent of notification transport.

## Targets and API evidence

Desktop Bridge was live-probed in local WebSocket mode. Original file `56nIowZmvBhb0QJvOlDQdU` / Slogan, page `102:2766` / 02 UI. Original nodes were not modified.

| Region                 | Original                                                  | Runtime/component                       | API classification                                                              |
| ---------------------- | --------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| Login brand            | `118:2970`, wordmark `121:3755`                           | `/sign-in`, LoginScreen                 | READY: existing password/Google login; this change only confirms brand spelling |
| Startup brand          | `206:2879`                                                | `/`, StartupGate + BrandLoading         | READY: existing session restore; browser fixture deliberately returns 401       |
| Me identity/language   | `152:1467`, name `217:3346`, pills `217:3348`/`217:3350`  | `/me`, MeScreen                         | READY: existing profile/edit/logout and local language persistence              |
| Empty Refresh          | `206:3032`, compact control at `(162,335,86,30)`          | `/partners`, `/messages`, MainListEmpty | READY: GET `/v1/people/available`, GET `/v1/me/conversations`                   |
| Candidate continuation | API `nextCursor` contract and SocialService bounded scans | PartnersScreen / social availableBatch  | READY: existing authenticated cursor API; no contract change                    |
| Main-page SSE | approved OpenSpec transport change | root LiveUpdatesProvider and focused consumers | READY locally: GET `/v1/me/live-updates`; cloud rollout recorded separately |

`figma/` contains original live plugin exports at 1×. `runtime/` contains final running screenshots. Open [comparison.html](comparison.html) for full-size pairs and overlay. Static images are not edited or used as implementation assets.

## Verification

| Check                                        | Actual result                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile lint                                  | PASS: zero warnings                                                                                                                                |
| Mobile typecheck                             | PASS                                                                                                                                               |
| Mobile unit suites                           | PASS: 65 suites / 244 tests plus the targeted lease-renewal UI regression, including candidate-scan and connection lifecycle coverage                                                                        |
| iOS bundle export                            | PASS: Expo export completed; this is not an installed iOS/device check                                                                             |
| Browser startup                              | PASS: held restoration shows the brand with one refresh request; completion enters login; warmed fast401 restoration never inserts `brand-loading` |
| Empty Refresh                                | PASS: measured `(162,335,86,30)`; click sends the existing authenticated operation                                                                 |
| Bounded candidate continuation               | PASS: ten empty pages display Load more; request 11 finds Later peer after the action                                                              |
| SSE planning validation                      | PASS: strict OpenSpec validation; proposal/spec/design/tasks all present                                                                           |
| Physical Android/iOS behavior                | NOT RUN; follow-up disclosed, owner instructed continuing deployment                                                                                                                                            |
| Production API/online-presence investigation | NOT RUN                                                                                                                                            |
| Public deployment                            | NOT RUN                                                                                                                                            |

Browser conditions: Chromium,390×844 logical pixels, DPR1, bundled Noto Sans SC faces, light theme. Expo route checks use the real router/session client with intercepted local HTTP responses. List/Me captures use the established visual harness with explicit auth/profile adapters. Neither proves production data, Redis availability, LiveKit or installed-device rendering. The401 console resource error in the startup scenario is the intentionally intercepted signed-out restoration; existing React Native web pointerEvents warnings remain.

## Source-to-runtime findings

| Region               | Findings and limits                                                                                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand                | Original exported logo reused by unchanged BrandLoading/LoginScreen; wordmark is Slogan,24px bold. Startup timing and single request verified independently of screenshot appearance.                                                                                                                                                        |
| Compact Refresh      | App control geometry matches the current original exactly in the measured browser shell. Source and runtime Noto Sans glyph edges differ slightly by rasterization. Source's retained prior title/navigation positions differ from runtime; those pre-existing regions are outside this compact-control correction. No whole-page 1:1 claim. |
| Me identity/language | Name starts at x86/y61, avatar x23/y65, language pills x86/x174/y99 and 80×24. Real profile imagery/content stays dynamic. The fixture avatar/name differ from the source's personal account data.                                                                                                                                           |
| Me menu/footer       | Existing46px control normalization, reports/update actions and main navigation are retained from earlier approved requirements. They differ from the source's three-row/no-navigation frame; this correction does not remove those behaviors or certify full-frame identity.                                                                 |
| Candidate absence    | Exhausted empty, budget-limited continuation and a later populated page are distinct. Failures retain localized feedback and known rows. The bounded traversal can require manual continuation for very large offline candidate sets.                                                                                                        |

Overall: scoped web behavior and compact-control visual evidence are verified. Full native visual/startup acceptance and the observed production blank remain PARTIAL pending device/live-data evidence. SSE implementation, migration, auth/privacy, cross-instance publication, presence expiry, bounded recovery, hosting-chain tests and rollback are recorded separately in the streaming acceptance report.

## Rollback

Restore the previous client release to roll back startup/layout/cursor/transport behavior. The additive API/outbox rollout and forward-repair policy are owned by the separate streaming release. Source originals and existing unrelated worktree changes remain intact. These visual results alone do not establish SSE cloud or native acceptance.
