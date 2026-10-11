## Context

See proposal.md for the problem and confirmed scope. The current client `validateBasic` combines missing gender, city, and display-name violations into `required`. `ProfilePolicy` independently requires gender, nationality/city, and numeric birth information. Prisma's `UserProfile` has non-null gender and birth columns. Age checks are duplicated in profile, room-sharing, and social repositories; optional birth information cannot safely be introduced only in the screen.

The connected Figma Desktop Bridge verified the original `02 UI / Profile / 基本资料 · V2` frame (`118:3095`, 390×844) on 2026-10-11. It contains the basic form but no optional labels, adult confirmation, or inline error states. Those states need a reviewed extension of the original frame before visual acceptance. No current 1:1 runtime acceptance is claimed.

## Decisions

### Nullable personal details and persisted adult confirmation

Make genderCode, birthYear, and birthMonth nullable in storage and optional in profile transport/domain inputs; location is already nullable but its combined mandatory domain check must be removed. Normalize blank optional fields to absence, not sentinel identities or made-up birthdays. Enforce the birth pair with a database constraint and domain validation. Add nullable `adultConfirmedAt`, set only by the server when an authenticated request explicitly submits `adultConfirmed: true`; clients cannot submit a timestamp. New profile completion requires the assertion. Existing profiles with a valid adult date remain eligible without a confirmation backfill.

Sentinel birth dates were rejected because they invent personal data and change age semantics. A client-only checkbox was rejected because direct API calls and other room/social consumers would disagree.

### Single adult decision

Expose a pure adult-eligibility policy through the profile module's public boundary and replace duplicated calculations in all consumers. Preserve the existing conservative eligibility date (first day of the month after the 18th birthday month); do not accidentally make the boundary one month earlier during this change. A supplied birth date takes precedence over an assertion. Retain previously recorded underage birth information when ordinary profile requests try to erase it; it cannot be bypassed by removing fields or setting the assertion. Evaluate eligibility using server time. Existing account availability, safety restrictions, membership and capacity checks remain authoritative.

### Form errors owned by fields

Replace the generic basic-step result with typed field violations, and apply the same approach to interests, CEFR, and adult confirmation. Display required/optional labels in both languages, render an error below each affected control, and scroll/focus the first invalid input using native-compatible refs. Recompute submitted validation as the user edits so resolved errors clear without hiding other outstanding errors. Map backend `PROFILE_INVALID` violations through a bounded field mapping; distinguish request/network failures from validation failures. Give year/month inputs explicit accessible labels. Preserve the existing Figma layout, tokens, and spacing except the approved additive labels, confirmation, and error states; error content participates in normal layout flow.

### Contract generation and backward compatibility

Use the existing NestJS code-first generator to publish only `openapi/openapi.yaml`, then regenerate `packages/api-client`. Old complete profile requests containing gender and birth values remain valid. Existing completed adult profiles do not require the new assertion on routine updates; first completion does. Optional output values must be handled by mobile, admin, room/social projection code and provisioning utilities; no consumer may calculate an age from null or display null as text. The default avatar and required display name/interests/CEFR stay outside this behavior change.

## Risks / Trade-offs

- Adult confirmation is self-declaration, not verified age proof. Preserve the adult-only policy and server enforcement, and describe the limitation accurately.
- An overlooked duplicated age check could deny confirmed adults or admit unknown users. Inventory all birth/age consumers and route them through the same policy, including room-sharing and invitations.
- Old clients cannot reliably consume nullable profile fields. Upgrade readers first and temporarily prevent creation of newly incomplete optional data until the compatible API/client rollout is complete.
- Incorrect error mapping can hide actionable failures. Keep a bounded mapping for known profile fields and a safe retry message for unknown failures.

## Migration and rollback

1. Add the timestamp and relax optional columns with a new forward migration; retain every existing value. Add a birth-pair constraint and preserve known-underage data through the application policy.
2. Deploy compatible readers and unified age checks before accepting omitted fields in production. Verify existing adult and underage profiles retain the old outcome and a new confirmed adult without birth details works across all consumers.
3. Publish the contract/client and mobile web/Android change together with the API accepting optional inputs. Record commit, migration, deployment, and APK versions independently.
4. Roll back application behavior through a compatibility release that can read nullable rows; do not restore NOT NULL constraints or deploy the old API against new nullable profiles. Pause new optional-profile writes if needed. Recover data from backups only for actual migration failure; do not fill missing personal details with fabricated values.

## Verification boundary

The user's latest no-test instruction remains in force: do not run local test suites in this planning turn or label checks as passed. During implementation, add meaningful regression coverage and keep execution explicitly pending unless authorized. Visual evidence requires original-Figma-to-runtime comparisons at 390×844 for empty, invalid, corrected, and valid optional forms. Live Google profile completion and Android keyboard/focus behavior require separate runtime/device evidence; deployment readiness alone proves neither.
