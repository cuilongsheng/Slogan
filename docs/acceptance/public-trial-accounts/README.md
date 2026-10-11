# Public trial account delivery

Target: `slogan-preview` on the explicitly owner-configured Neon database. The separate trial registry contains only demo_s1, demo_s2 and demo_m1. Existing five-slot private provisioning remains unchanged. No private passwords, connection strings or tokens are published.

## Upgrade evidence

The named target received an authenticated AES-256-GCM PostgreSQL backup in owner-only storage. The optional-profile, trial metadata and credential/revocation constraints migrations completed. Private provisioning records, credential hashes and account status were compared before/after and remained identical. Backup authentication and custom archive header were checked; a recovery restore was not executed.

The first atomic provision attempt was rejected by the legacy credential-origin database check. It rolled back without a partial account set. A separate forward migration extends that check for explicitly registered public credentials and preserves the existing verification cases. It also permits audited system revocation only for the public viewer role, leaving private-role actor pairing intact. Applied migrations were not rewritten.

## Verification boundary

API/mobile type checks, API compilation and generated contract/client completed. Regression examples were added but automated suites were not run under the owner instruction. Deployed login, denial/redaction, browser navigation and public README publication are release gates recorded below when verified. Device checks remain the owner's responsibility.

## Runtime results

On October 11, 2026, PR #15 merged application commit `d5e0b8dc15ff9f5acfe15bfc5a0a094eda17f44b`. The Vercel API commit header and both Cloudflare Pages release manifests matched that commit. Auth capabilities reported password/Google enabled and email disabled.

Provisioning created exactly three active public identities. A repeated provision returned the existing set without creating users or resetting credentials. Both mobile identities have no global backoffice role; demo_m1 has only PUBLIC_TRIAL_VIEWER.

All three native password exchanges returned 200 / ELIGIBLE. Both mobile accounts were denied backoffice access (403). The viewer read its own backoffice identity and public-room summary (200), while operational rooms, role assignments, safety cases, room creation and profile mutation returned 403. The live public-room dataset was empty; field redaction is additionally supported by inspection of the explicit Prisma selection, rather than claimed as a populated-data runtime check.

Both Pages origins completed browser password exchange, secure HttpOnly refresh-cookie issuance, refresh rotation and logout. Revoked access tokens were rejected with 401. All five existing private accounts still authenticated; every temporary API validation session was logged out.

The independent browser session showed only the room-management navigation, an explicit read-only notice, current-room counts and the empty state. The existing owner's Chrome sessions were preserved. The new permission state is compared with the original V3 design below; it is not an overall pixel-identity claim.

| Evidence                                         | Scope                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| [Original V3 frame](original-admin-153-1524.png) | Desktop Bridge export of frame 153:1524, 1440 × 900                            |
| [Production viewer](viewer-runtime.jpg)          | Actual demo_m1 session at a 1440 × 900 CSS viewport; full-page browser capture |

Sidebar width, header, typography and page shell reuse the existing design. Non-permitted navigation, private filtering and sensitive card fields are omitted by the approved public-viewer boundary. The added notice/counts and empty dataset differ from the populated administrator design. Populated-card visual comparison and native device acceptance remain unverified. Public credential instructions are prepared for both root READMEs after these deployed authorization checks.

## Rollback

See the [operator guide](../../deployment/public-trial-accounts.md). Disable only public identities and their sessions, remove public README credentials, and retain additive schema/nullable readers. Do not retire the private five slots.
