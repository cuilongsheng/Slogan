# Optional profiles, public trial access and mobile polish

Application delivery: [PR #15](https://github.com/cuilongsheng/Slogan/pull/15), merged as `d5e0b8dc15ff9f5acfe15bfc5a0a094eda17f44b` on October 11, 2026.

## Deployed application

The production API commit header and both Cloudflare Pages release manifests matched the application commit. API capabilities reported password and Google enabled, email disabled. No provider credentials were replaced during this rollout.

Gender, city and birth information are optional; first profile completion still requires explicit adult confirmation. Birth-based restrictions take precedence. Field-specific localized messages replace the generic required-fields-only feedback.

WeChat and unavailable expression assistance are disabled. The assistance notice remains visible, while the disabled path does not initialize recording or alter the room microphone. English rule typography, four-column discovery navigation and the opaque room-creation keyboard footer are updated. Native crash, keyboard and audio checks remain owner validation.

## Data and public access

The explicitly configured slogan-preview Neon target received an encrypted authenticated PostgreSQL backup and three additive migrations: optional profile details, public trial ownership, and scoped credential/revocation constraints. Existing five-slot records, password hashes and account statuses were unchanged. Backup authentication and archive format were verified; a restore was not executed.

Public identities demo_s1 and demo_s2 have ordinary product permissions. demo_m1 has only PUBLIC_TRIAL_VIEWER. Provisioning created the three once; repeating it returned the same set without resets. Both public mobile identities were denied backoffice access. The viewer can read only its own session identity and sanitized public current/scheduled room summaries; operational rooms, roles, safety records and business mutations were denied.

Native exchanges, both Pages browser exchange flows, secure refresh cookies, rotation and logout were checked. All five private accounts remained able to authenticate. Validation tokens were revoked afterward. No temporary room or synthetic production activity was inserted. The live public summary was empty, so populated-data redaction is supported by the explicit server projection rather than claimed as populated runtime evidence.

Public credentials and shared-account limitations are published by the bilingual root README follow-up. Private credentials remain unpublished. For emergency exposure rollback, use the [public trial operator guide](../deployment/public-trial-accounts.md) to disable only public identities and sessions, and remove the public instructions. Retain compatible schema and private accounts.

## Evidence and remaining acceptance

- [Mobile preview captures](../acceptance/mobile-preview-polish/README.md)
- [Optional profile captures and boundaries](../acceptance/optional-profile/README.md)
- [Public trial authorization and browser evidence](../acceptance/public-trial-accounts/README.md)
- API/mobile type checks, API/admin builds, changed-scope lint and OpenSpec validation passed.
- No automated local suites ran under the owner's instruction. GitHub delivery checks and the branch Android build passed.
- Native checks, full Google first-profile acceptance and populated viewer-card visual comparison remain unverified. These changes are not archived as fully accepted.

## Android release

The main workflow rebuilds the APK and publishes it only when the API and both Pages match the same current main commit. [Public download metadata](https://slogan-preview-mobile.pages.dev/downloads/android.json) and [GitHub Releases](https://github.com/cuilongsheng/Slogan/releases) are the runtime release record. The README follow-up also triggers this gate; a branch APK is not declared the latest public release.
