## 1. Confirm visual states

- [ ] 1.1 Extend the original profile Figma frame through Desktop Bridge with optional labels, an unchecked adult confirmation, and field error/correction states in both languages; verify the named original frame and exported 390×844 screenshots, and obtain review before visual implementation.

## 2. Persist optional details and adult eligibility

- [x] 2.1 Add nullable profile details, a server-owned adult confirmation timestamp, and a birth-pair constraint in a new Prisma migration; verify migration review preserves existing values and document compatible rollback without fabricated backfills.
- [x] 2.2 Update profile domain validation, DTOs, repository mapping, and first-completion/update compatibility; verify recorded examples cover omitted details, partial/invalid dates, old complete requests, absent confirmation, and an assertion conflicting with a known-underage profile.
- [x] 2.3 Replace duplicate birth calculations in auth/profile, room/share, and social/invitation eligibility with one public profile policy; verify the consumer inventory has no independent null-unsafe calculation and all examples preserve the conservative adult boundary and existing safety/account checks.
- [x] 2.4 Generate the sole OpenAPI contract and API client from NestJS DTOs, update optional-field consumers/provisioning utilities, and review the diff for consistent input/output optionality and timestamp ownership.

## 3. Fix profile forms

- [x] 3.1 Update the shared web/Android draft and payload mapping to omit blank optional details, validate a supplied birth pair, and submit explicit adult confirmation; verify payload examples contain no invented gender, location, or birth date and both steps preserve entered values.
- [x] 3.2 Add required/optional labels and localized field-level errors to both steps, clear resolved errors, scroll/focus the first invalid input, and map server violations; verify missing name, invalid month, missing interest/CEFR, and absent adult confirmation each identify their own control while optional omissions produce no error.
- [ ] 3.3 Compare the original approved Figma frame directly with the running frontend at 390×844 in empty, invalid, corrected, and completed states; record screenshots and remaining device-specific differences without claiming test/build evidence proves visual equivalence.

## 4. Verification and delivery

- [ ] 4.1 Add meaningful regression coverage for nullable details, assertion precedence, old-profile compatibility, all eligibility consumers, field error placement, and correction; execute the affected suite only when authorized and report unrun checks explicitly.
- [ ] 4.2 Validate database upgrade/recovery and the real Google first-profile flow with optional details omitted, plus Android keyboard/focus behavior; record runtime and owner/device evidence separately from CI.
- [ ] 4.3 Sync accepted requirements, commit only this change, and deliver the compatible database/API, mobile web, and Android rollout through the authorized PR workflow; verify release commit, migration, deployment and APK metadata separately, and archive only after applicable acceptance evidence is complete.

Implementation note (2026-10-11): code and contract generation are complete; type checking and admin compilation succeeded. Automated suites were not run under the owner instruction. The named production database received an authenticated encrypted backup and the additive migrations; private provisioning records and credential hashes were unchanged. Browser captures record inline errors and correction; full visual and native device acceptance remains separate. See docs/acceptance/optional-profile/README.md.
