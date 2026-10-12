# Complete phase-one release

## Why

The owner approved completing the 2026-10-11 audit backlog before one consolidated test and deployment cycle. Missing partner/private-conversation delivery remains owned by `add-partner-discovery-direct-conversations`; this change owns the remaining profile, localization, security, managed execution, and release infrastructure work.

## What changes

- Provide an application-owned default avatar and bounded authenticated image replacement. Provider images remain optional suggestions; absence cannot prevent onboarding.
- Persist an explicit Chinese/English preference, with device language as the initial default. Preserve the three primary Me actions.
- Use shared authentication throttles and fail closed when their configured shared store is unavailable.
- Deliver durable managed scheduling for enabled maintenance/recovery tasks on Vercel, with leases and repeatable operations.
- Gate schema-changing production releases on encrypted backup, compatible migrations, verification, and isolated restore evidence. Preview branches must never migrate production.
- Add CI coverage and reconcile stale delivery documents and completed OpenSpec changes.

- Incorporate the owner-approved 2026-10-12 simplification of partner, recent-message, chat and direct-call layouts, with a matching V2 high-fidelity design.

## Impacted delivery stages

- Architecture
- Prototype / Figma
- Backend / API
- Frontend
- Test / Acceptance
- Deployment

## Scope exclusions

WeChat, email registration/recovery, expression assistance, room speech processing, iOS, offline push, and message media attachments remain disabled/deferred. Device validation remains owner-operated.
