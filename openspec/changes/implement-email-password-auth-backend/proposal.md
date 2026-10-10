## Why

The existing backend supports Google, WeChat and mobile phone number authentication, but email registration, verification and password retrieval are still prototypes. It is necessary to complete the username and password authentication that can be used independently and can be bound to an existing account, and continue to use existing session, data and account deletion boundaries.

## What Changes

### Confirmed scope

- Use the existing prototype: unique username, email and password registration; username and password login; verification email resending, email verification and password reset.
- Business sessions will not be issued if registration is not verified; after email verification is completed, log in with user name and password to enter the existing data initialization process.
- After the logged-in user is re-authenticated through the current login method, the target email address is verified and the username and password are bound; it is not automatically associated based on the email address returned by OAuth.
- Password reset will cancel all platform sessions of the account; email password accounts can perform the existing account deletion process through password re-authentication, and the deleted identity cannot be re-registered or revived.
- Provides replaceable transaction email adapter, persistent delivery and controlled retry, rate limiting, one-time credentials and log desensitization; independent acceptance of authentic email proof.

### Non-goals

- Do not develop mobile or management UI, do not modify Google/WeChat interaction, do not change room permissions or data adult rules.
- Does not implement email as login name, username retrieval, username modification, email linking/unbinding, merging two existing accounts, MFA or general email marketing platform.
- No new operation backend or cross-domain governance system will be built, and no production deployment will be carried out.

### Roadmap and unresolved decisions

- Mail provider, authenticated sending domain, and client validation/reset bounce addresses are real environment configurations; use SMTP transaction mail adapter and fixed allowed HTTPS bounce addresses, keeping the portal closed when configuration is missing.
- Prototype change `add-email-password-auth` is still responsible for visual acceptance. This change declares the backend capabilities separately, does not synchronize the unaccepted delta of the prototype, and does not change its third-party login UI description into backend authorization.

## Capabilities

### New Capabilities

- `email-password-authentication`: Username and password registration and login, email verification/resending, password recovery, existing account binding, session invalidation, account deletion compatibility and transaction email security.

### Modified Capabilities

None. The data and adult boundaries of the main specification `identity-and-profile` are inherited; the complete backend contract of the new login method is carried by the new capability.

## Impact

- Impacted delivery stages：Architecture、Backend / API、Test / Acceptance。
- Expand the public re-authentication entrance of `apps/api/src/modules/auth/` and account-lifecycle; continue to use SessionService and do not add an independent token system.
- Prisma adds email credentials, applications to be verified, one-time challenges and email outboxes; using additive migration.
- Add SMTP adapter, background delivery/expiration cleanup entry and Zod configuration; Redis is responsible for cross-process rate limiting, and PostgreSQL saves identity and command facts.
- NestJS code-first one-way generation `openapi/openapi.yaml`; added HTTP contract, historical migration test and local/real email acceptance record.
