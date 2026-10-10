## 1. Enter the room directly

- [x] 1.1 Create a direct room entry intention from the list and details and enter the session; use component testing to verify one click, double click, wrong room draft and invitation identifier.
- [x] 1.2 Submit the password to join directly, cancel the rules and device front path; use the password input to test and verify the four-digit verification and routing.
- [x] 1.3 Provide a return list, necessary authorization and retry when joining fails; use session/component testing to verify that unauthorized access will not be automatically accepted, and microphone rejection will not falsely report that the microphone is open.

## 2. Verification and Delivery

- [x] 2.1 Execute complete mobile lint/typecheck/tests, Pages build and OpenSpec strict; record the differences between the final running process screenshot and Figma, and the physical device is verified by the user.
- [x] 2.2 Submit code and create PR, verify front-end and back-end previews and Android builds; check production submissions and fixed downloads after merging, and record unfinished cloud or device thresholds.

## 3. User physical device acceptance correction

- [x] 3.1 Unify details, sharing, invitations, old rules and equipment to deeply link to direct room entry; password is changed to a pop-up window on the current page to verify missing/wrong passwords and invitation retention.
- [x] 3.2 Based on Bridge original manuscript 115:1425, repair the room members, chat and bottom bar layout, retaining all real behaviors.
- [ ] 3.3 Perform mobile checks, portal regressions, and manuscript/running graph comparisons, submit PRs, and deliver new APKs that verify submissions and checksums; physical device is verified by the user.

## 4. Automatic device check (user approved, suspended for publication)

- [x] 4.1 Native/Web automatically detects input, output and permissions, always mutes by default, detects track release and checks out race testing.
- [x] 4.2 In-room problem prompts, retry and system settings entrance; no fixed preparation page, real component status is verified, and the physical device is verified by the user.

This round of implementation and local checking is completed; PR/APK release in 3.3 is suspended at user request, and native physical device checking is not performed.
