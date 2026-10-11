## Why

The public README needs usable trial accounts without publishing the private pilot administrator or safety credentials. Existing provisioning supports five private slots, rejects shared weak passwords, and offers no public-safe backoffice viewer.

## What Changes

- Provision two ordinary trial users (`demo_s1`, `demo_s2`) and a separate read-only backoffice trial user (`demo_m1`), with the explicitly public password `12345678`.
- Scope the shared-password exception to controlled public-trial provisioning; retain normal registration/password policy and the five existing private pilot accounts.
- Enforce public-safe read access and denial of business mutations on the server. Exclude real safety evidence, private messages, credentials, and identifiable audit records.
- Publish these three credentials and their limitations in both root READMEs only after deployment/provisioning succeeds.
- Preserve the existing Google sign-in/session implementation; enabling its existing provider configuration is a separate deployment activity.

### Confirmed scope

The user approved compliant usernames, one shared public password, and read-only backoffice access. Treat the password instruction as applying to these three public accounts, not resetting unrelated private identities.

### Non-goals

No globally weaker password policy, private administrator reset, unrestricted public administrator, permanent demo room, fabricated production data, or new language/category feature.

## Capabilities

### New Capabilities

- `public-trial-accounts`: Environment-bound public identities, controlled provisioning, limited backoffice access, and truthful credential publication.

### Modified Capabilities

- `backoffice-access-control`: Add an explicitly restricted public viewer while preserving all existing role permissions and revocation behavior.

## Impact

Authentication provisioning, Prisma account/role metadata and additive migrations, server authorization/read projections, generated OpenAPI role types, admin permission handling, deployment guides, and bilingual README trial instructions. No new external dependency is expected.

## Impacted delivery stages

- Architecture
- Backend / API
- Frontend
- Test / Acceptance
- Deployment

## Decisions requiring review

The initial public viewer will show sanitized active/scheduled room summaries and aggregate counts only. Real moderation, audit, governance, and role data remain inaccessible. Broader public-safe datasets require a later explicit scope decision.
