# Five local preview accounts

This change enables five controlled password identities without SMTP. Ordinary email registration/verification/recovery remains unchanged when mail is enabled. Google is an independent normal login capability. A room host is assigned by creating a room, never by an account-wide role.

## Configuration and secrets

| Mode               | PASSWORD | MAIL  | PREVIEW |
| ------------------ | -------- | ----- | ------- |
| Disabled           | false    | false | false   |
| Normal email       | true     | true  | false   |
| Controlled preview | true     | false | true    |

The preview mode requires Redis, an HMAC key ring and an explicit PREVIEW_ENVIRONMENT_ID. It does not require SMTP, AES or verification/reset URLs. Omitted MAIL preserves the old PASSWORD-derived behavior. Password hashing, quotas, persistent sessions, refresh rotation and current RBAC still apply. Preview credentials have PREVIEW_PROVISIONED origin, verifiedAt=null and a non-deliverable @preview.invalid placeholder. They cannot log in without an active matching environment mapping.

Build from the change worktree with the pinned Node/pnpm. Keep the database target in PREVIEW_DATABASE_URL and runtime configuration in an owner-only, gitignored environment file. `--environment` must exactly match its environment ID. Never put passwords or bearer tokens in command arguments, logs, screenshots or this document. The input JSON is an array of the ADMIN, SAFETY, MOBILE_A, MOBILE_B and MOBILE_C slots, each with a unique username/password. Mobile slots also include a complete adult profile accepted by ProfilesService. Use owner-only 0600 regular files owned by the executing user; symlinks are rejected.

## Initialization and authorization

From `apps/api`, after building:

```sh
node --env-file=/absolute/private/runtime.env dist/scripts/preview-accounts.js --action dry-run --environment ENVIRONMENT_ID --input /absolute/private/accounts.json
node --env-file=/absolute/private/runtime.env dist/scripts/preview-accounts.js --action initialize --environment ENVIRONMENT_ID --input /absolute/private/accounts.json
node --env-file=/absolute/private/runtime.env dist/scripts/preview-accounts.js --action bootstrap --environment ENVIRONMENT_ID
node --env-file=/absolute/private/runtime.env dist/scripts/preview-accounts.js --action roles --environment ENVIRONMENT_ID --input /absolute/private/accounts.json --api-url http://127.0.0.1:6262
node --env-file=/absolute/private/runtime.env dist/scripts/preview-accounts.js --action status --environment ENVIRONMENT_ID
```

Start the matching API before `roles`. That command authenticates the new admin through the ordinary password service, verifies its live session and permission, calls the normal audited role HTTP endpoints, and revokes its temporary CLI session afterward. Final roles must be ADMIN=[PLATFORM_ADMIN], SAFETY=[SAFETY_OFFICER], and each mobile slot=[]. A data-only result reports ROLES_PENDING. Stable command UUIDs support interrupted role separation; successful retries do not re-bootstrap the final single-role administrator or overwrite passwords/profiles.

With an existing administrator, pass `--authorization-mode existing-admin` to initialize/dry-run. Preserve its authority and supply its real normal access session via a 0600 `--operator-input` JSON file with an accessToken for the roles command. No token is minted from a manifest actor ID. The operator session is not revoked by the CLI.

## Approved original development database rebuild

The user approved retaining only five usable accounts in the original local development database. The exceptional cleanup action applies solely to NODE_ENV=development, 127.0.0.1:5432/slogan and environment local-preview, with explicit `--authorization-mode local-rebuild` and a 0600 custom-format PostgreSQL backup. Other environments/hosts/databases, production and missing/invalid backups are refused. No public API receives this exception.

Stop services that can create users or issue email before taking a backup. Verify the local target, create a custom-format pg_dump with umask 077 to a gitignored private path, and inspect its archive using pg_restore --list. Do not overwrite a recovery backup. Apply the additive migration, then run:

```sh
node --env-file=/absolute/private/runtime.env dist/scripts/preview-accounts.js --action cleanup-local --environment local-preview --authorization-mode local-rebuild --backup /absolute/private/backup.dump
```

Only unregistered ACTIVE old users are retired. Old development roles, including the old last administrator, can be revoked under this human-approved local exception. Revocations use SYSTEM_JOB audits; the legacy revoker foreign key points to a newly created terminal, credential-free maintenance marker, never to a fabricated login session. Account lifecycle deletion destroys password hashes, revokes sessions/realtime identities, handles room/social state and retains audit/FK history. Historical DELETED rows are expected; exactly five ACTIVE usable accounts is the criterion. Interrupted cleanup resumes still-active old identities; it never revives a registered retired/deleted preview identity. Do not run test fixtures, DROP DATABASE or unrelated table cleanup.

Then use the standard initialize/bootstrap/roles flow. The ordinary public last-admin protection remains in effect. General preview retirement uses real password deletion proof and account-deletion confirmation; administrators require a legitimate successor before normal role revocation and deletion.

## Mail stop and recovery

Stop/drain the separate auth-mail worker first; SMTP submissions already accepted cannot be recalled. Set MAIL=false and deploy the matching API. Run `--action cancel-mail` with the explicit target/environment: pending/running deliveries are cancelled, their payloads cleared, generations fenced, email challenges/link proofs invalidated, and unfinished enrollment secrets cleared. ACCOUNT_DELETE proofs remain valid until their normal expiry. The worker still performs expiry cleanup with mail disabled, but does not claim/decrypt/send. Repeated cancellation is safe, and re-enabling mail will not send the cancelled backlog.

Before schema migration/rebuild, retain the safe backup. Disable preview and revoke sessions for an urgent capability stop. Do not roll an old binary back onto nullable verifiedAt preview rows. To restore pre-change data, stop services and restore the safe backup into an isolated local verification target first; compare migrations/account/role/audit state before any intentional replacement of the original development data. The change does not provide remote restore or deployment authorization.

## Local use and remaining acceptance

The implementation worktree contains the required backend code. Original `.env` and AI settings remain untouched; the private preview runtime disables AI/STT/realtime. Start the API using the private runtime and point admin VITE_API_BASE_URL and mobile EXPO_PUBLIC_API_BASE_URL to http://127.0.0.1:6262. Serve the mobile assets/icons directory at 127.0.0.1:6263 for the three local profile avatars. Browser origins localhost/127.0.0.1 at 5173 and 8081 are allowed. Use three separate browser contexts/devices for mobile identities.

A creates a capacity-three room, B/C accept rules and join; end it, then B creates another room. This checks normal control-plane identity and dynamic host behavior. Actual three-client audio publish/subscribe requires a separately configured LiveKit environment and device/microphone evidence. Real Google OAuth, public HTTPS/webhook, real SMTP, Figma visual comparison and formal deployment remain independent acceptance gates. The mobile UI capability/closed-email states require the connected Desktop Bridge before UI implementation; backend refusal is already enforced even with old links/direct requests.

## Current machine startup

These services are already running. To start them again after stopping, use the pinned Node from the implementation worktree. Run each long-lived command in a separate terminal:

```sh
cd /Users/cls/.codex/worktrees/preview-experience-accounts/Slogan
source ~/.nvm/nvm.sh
nvm use
node --env-file=/Users/cls/Documents/Slogan/.env.preview-runtime apps/api/dist/main.js
```

```sh
cd /Users/cls/.codex/worktrees/preview-experience-accounts/Slogan
source ~/.nvm/nvm.sh
nvm use
VITE_API_BASE_URL=http://127.0.0.1:6262 pnpm --filter @slogan/admin dev --host 127.0.0.1 --port 5173 --strictPort
```

```sh
cd /Users/cls/.codex/worktrees/preview-experience-accounts/Slogan/apps/mobile/assets/icons
python3 -m http.server 6263 --bind 127.0.0.1
```

For the existing mobile Web app (not currently started), from the implementation worktree after activating Node:

```sh
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:6262 pnpm --filter @slogan/mobile start --web --port 8081
```

The runtime browser origin allowlist includes both localhost and 127.0.0.1 at ports 5173/8081; use the same hostname for the frontend and API for browser cookies. Google provider registered redirect configuration and LiveKit/audio remain unverified. The new capability-based visibility/closed-email UI tasks are still pending Desktop Bridge confirmation.
