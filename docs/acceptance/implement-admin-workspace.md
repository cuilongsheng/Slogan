# PC management background acceptance record (2026-09-28)

## Implementation and Contracts

- The six confirmed Figma V2 main pages correspond to rooms, cases, appeals, downgrade events, roles and audits; the front-end uses the generated client and the current administrative role to determine routing, and the server continues to authenticate independently.
- Browser session restored by HttpOnly refresh Cookie, access token only remains in memory. The real local Google account obtained `PLATFORM_ADMIN` and `SAFETY_OFFICER` through controlled bootstrap. Six pages have been opened in the browser and the roles and audit records have been read.
- The code-first OpenAPI structure has been added to the room details response. Case and appeal statistics are provided by the new full summary API; "pending cases" include `OPEN` and `UNDER_REVIEW`, which are visible to the administrator/safety officer; appeal statistics are only readable by the safety officer. Unknown value is displayed on failure, but the list can still be queried independently.
- The high-privilege command generates and retains `clientRequestId` when entering the operation process. If it fails, the same identifier will be used for retries; the server will refresh the relevant query after success. The role grant is now entered in the side column and then confirmed in the sensitive operation pop-up layer; the appeal decision is confirmed after being entered in the details side column.

## Verification

- `pnpm --filter @slogan/admin lint`, `typecheck`, `test`, `build` passed.
- `pnpm --filter @slogan/api test:integration`: 36 groups, 196 tests passed.
- The summary count of API E2E and the ordinary account 403 have passed; the full set of API E2E passed for the first time for the 15/16 group, and the remaining use cases failed due to the old expectation of the new member response `userId`. After correcting expectations, 6 tests of this voice HTTP group passed.
- `pnpm exec playwright test tests/e2e/admin-visual.e2e.spec.ts`: 1440×900 deterministic screenshots of six main pages and four overlays, statistics and two-step confirmation assertion passed. The screenshot has been saved to `docs/acceptance/assets/admin-*-1440-visual-fixture.png`, which belongs to the local visual fixture and is not real production data.
- `pnpm --filter @slogan/api-client generate:check` passed; see the task execution record for strict verification of OpenSpec change.

## Six pages of visual differences

| page      | There is evidence                                            | Remaining differences from design/contract                                                                                                                                                             |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room      | [Screenshot](assets/admin-rooms-1440-visual-fixture.png)     | `add-admin-room-filters` has received full server theme/complete UUID, status, visibility and creation time lower bound filtering; the design draft-friendly short number still has no contract field. |
| Case      | [Screenshot](assets/admin-cases-1440-visual-fixture.png)     | Full usage statistics of three cards; status and 7/30-day server filtering are available. There is no corresponding contract in the full text search of the design draft.                              |
| Appeal | [Screenshot](assets/admin-appeals-1440-visual-fixture.png)   | Three cards use full statistics; the contract only supports status filtering, without full-text search and time filtering.                                                                             |
| Downgrade | [Screenshot](assets/admin-incidents-1440-visual-fixture.png) | Status, component, and 7/30 day filtering available; room ID filtering has no page input yet.                                                                                                          |
| role      | [Screenshot](assets/admin-roles-1440-visual-fixture.png)     | Role filtering available; user query has no page input yet.                                                                                                                                            |
| Audit     | [Screenshot](assets/admin-audit-1440-visual-fixture.png)     | Results and 7/30 day filtering available; no page input for action, target, and operator queries yet.                                                                                                  |

## Four visual evidence of overlay

| Overlay                | Screenshot during runtime                                            | Current difference                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case details           | [Screenshot](assets/admin-case-detail-1440-visual-fixture.png)       | Friendly numbers such as `CASE-1041` in the design draft have no API fields, and the interface displays a truncated UUID; the evidence card shows the actual content of the server.      |
| Appeal details      | [Screenshot](assets/admin-appeal-detail-1440-visual-fixture.png)     | `APL-302` and `RST-668` in the design draft have no API fields, and the interface displays a truncated UUID; the decision has been placed in the sidebar and submitted for confirmation. |
| Grant role             | [Screenshot](assets/admin-role-grant-1440-visual-fixture.png)        | The input fields and prompts have been compared; the target user uses the UUID required by the contract.                                                                                 |
| Sensitive confirmation | [Screenshot](assets/admin-sensitive-confirm-1440-visual-fixture.png) | Cards around 420×280, yellow warnings and double buttons have been compared; the real target summary comes from the selected record.                                                     |

## Not accepted yet

- The six main pages and four overlays have been screenshotted and checked one by one; there are the above differences between the business data field and the design placeholder text, and font rendering depends on the operating system, so pixel-level 1:1 is not claimed. Some design controls lack API contracts or page inputs, see the table above for details.
- There are no real pending cases/grievances on this machine, so the real browser paths for case handling and role revocation have not yet been data accepted. Automated verification of permissions, confirmations, conflicts and server-side commands.
- `OPERATIONS_ANALYST`’s independent indicator workbench does not yet have an approved design draft and corresponding front-end changes.
