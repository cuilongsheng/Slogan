# Slogan background management prototype coverage

Status: **Product Review Draft**. The Figma canvas is a visual prototype, and the functions are based on `openspec/specs/`; the sample data are fictitious identifier.

File: [Slogan / Admin Prototype / V1](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2007). The canvas is located on page `01 Prototype` and does not cover the mobile prototype. Desktop frame size is 1440 × 900.

| page                     | Figma node                                                                              | Type                                                                                                       | Requirement basis and boundary                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room management          | [102:2010](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2010) | Card                                                                                                       | User specified card format. There is no background room processing command in the current main specification; cards and filters are information structures to be confirmed.   |
| Security Case            | [102:2041](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2041) | Table + [Details drawer](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2642)      | `safety-case-management`: paging, status/time/user filtering, role visibility range, manual processing and evidence boundaries.                                               |
| Limit appeals            | [102:2072](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2072) | Table + [Deciding on drawers](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2671) | `safety-restriction-appeals`: Safety officer checks the pending appeals and requires reasons for maintenance/dismissal.                                                       |
| Security downgrade event | [102:2103](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2103) | Table                                                                                                      | `room-sensitive-speech-detection`: Read-only query by room, time, component, and status.                                                                                      |
| Admin role               | [102:2134](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2134) | Table + [Grant drawer](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2692)        | `backoffice-access-control`: Multiple roles, reasons, role separation, and final administrator protection. The cancellation form is pending for the next round of refinement. |
| Operational audit        | [102:2165](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2165) | Read-only table                                                                                            | `backoffice-audit`: Paging query by time, operator, action, target, and result; no editing or deletion is provided.                                                           |

## Clickable path

- Prototype entrance: `后台管理 / 案件入口`, starting from the security case page.
- The left navigation of the six pages are connected to each other; the grouping and fine-tuning status refer to the background screenshot given by the user, but the layout and business structure are defined by Slogan.
- `CASE-1041` in the security case table, `APL-302` in the appeal table, and "Grant role" on the role page can open the corresponding drawer; the drawer can be closed, and the decision button enters [Second confirmation indication](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2714).
- Filtering, search, paging, form input and actual submission are currently structural representations without data linkage. Other example lines should not be interpreted as having independent detail data implemented.

## Product Review Point

1. What background permissions and actions are required for room management? Currently, only card information and filtering can be reviewed, and actions such as banning, disbanding, and handover cannot be deduced from the reference picture.
2. Do the case list and appeal list need additional columns? The role-specific visible range needs to be verified based on the current session.
3. Whether drawers are used for case details; whether the status of missing evidence/downgraded/no risk signal is clear enough.
4. Whether role revocation and audit details need to be independent drawers, or continue to be carried by table row operations.
5. Operation indicators and governance views are back-end changes during activities and are not included in the current main specification prototype; the corresponding pages will be designed after the scope is approved.
