## Why

First-time Google sign-in reaches a profile form that blocks continuation for undisclosed gender, city, or birth details and gives an unhelpful generic error. The user confirmed that these three details must be optional and that the adult boundary must remain through an explicit adult confirmation.

## What Changes

- Make gender, city/nationality, and birth year/month optional during profile completion. Never fabricate a city, gender, or birth date to satisfy the existing backend.
- Preserve adult access through an unchecked-by-default “I am at least 18 years old” confirmation. Persist the confirmation on the server; a supplied underage birth date takes precedence over the assertion.
- Show required/optional labels and field-specific, localized validation next to the affected input. Clear corrected errors and preserve entered values on failure.
- Apply the same behavior to mobile web and Android, including both profile steps and server error mapping.
- Expand the profile schema compatibly, preserve existing profile data and adult eligibility, and update the generated API contract/client.

## Capabilities

### Modified Capabilities

- `identity-and-profile`: Optional personal details, explicit adult confirmation, and actionable profile validation.

## Impact

- OpenSpec requirements and approved Figma profile/error states.
- Mobile profile draft, screens, bilingual messages, and authenticated profile submission.
- API profile DTOs/domain/repository, all room/social eligibility consumers, Prisma migration, generated OpenAPI/client, and existing account provisioning inputs.
- Release order: additive database migration, compatible API, then mobile web and Android. Production publication and device acceptance remain separate evidence.

## Non-goals

No changes to OAuth identity association, public trial accounts, login providers, avatar upload, or the frozen first PRD. Do not remove the adult-only room boundary. Existing required display name, avatar, interests, and CEFR level remain required in this change.
