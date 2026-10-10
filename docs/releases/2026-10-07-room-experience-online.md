# Room experience online release record

2026-10-07。 The user has authorized four database migrations and existing environment releases; physical device testing is performed by the user.

## Completed

- Online database completes private local backup, 236,281 bytes; SHA-256 `e927bb96793bd15928572e2612b81cef5786024de3f6870c6800db75bb6cf1f1`, `pg_restore --list` is readable. Backup not entering Git.
- Neon `slogan-preview` / `main` / `neondb` Four incremental migrations have been completed, with a total of 25 completed migrations and 0 failures; the original 5 users and 4 rooms are retained, and the level field and message foreign key are correct. See [Migration evidence](../acceptance/simplify-room-and-mobile-experience/production-migrations.json).
- Vercel and two Cloudflare Pages preview builds for release commit `2f03998e110dd55b3987bd6ffdb33762f3aef8b0` were successful. Successful preview does not mean production release.
- The 5 preset account and password logins of the current production API are passed, and the two production Pages originating from the same browser exchange / HttpOnly refresh cookie / logout are passed; Google remains closed. See [Certification evidence](../acceptance/simplify-room-and-mobile-experience/production-auth-smoke.json).
- The final contract review completes the publicly shared level range field and corrects the contract description that the room host must explicitly select the successor; the generation and consistency check passed.

## 2026-10-07 Pre-release status

At that time, GitHub main repository rules required PR. Connector not logged in, Chrome form actions unavailable due to Mac lock screen, PR not created or merged yet; production API/Pages are still old commits. No repository rules bypassed or rules changed. Wait until the user unlocks the Mac to continue creating PRs, merging, tracking production deployments, and validating text messages, scopes, fast exits, and responding to out-of-queue cleanup.

There is no PASS evidence for cleanup convergence and failure recovery after the cloud consumer triggers and stops the client. Complete vision, physical device keyboard, two-machine audio and real STT/AI remain unfinished, OpenSpec is not archived. See [APK record](2026-10-07-room-experience-android.md) for Android products, but iOS is not included.

See [Queue scheme](../deployment/room-experience-vercel-queues.md) for the release and rollback sequence.

## 2026-10-08 Automatic delivery renewal

Added the GitHub Release release of the PR/codex branch APK build and main production verification in the same repository. Pages provides fixed download redirection and does not put APKs exceeding 25 MiB directly into static products. API response headers, Pages release.json, and APK built-in commits are all used to verify the actual version. See [Automatic delivery solution](../deployment/android-automatic-delivery.md) for configuration, and see [Acceptance record](../acceptance/automate-android-release-delivery/README.md) for current local evidence and cloud unfinished items.

## 2026-10-08 Production release and practical problems

[PR #9](https://github.com/cuilongsheng/Slogan/pull/9) has been merged, the production API, admin/mobile Pages and GitHub Release APK are all `fc7bbf86cb28ee315c6e57e4d2a62a0dfc8e56d3`. Android automatic build and release passed, fixed download, actual file hash, signature, native logo and 15 icons verified; see [Cloud delivery evidence](../acceptance/automate-android-release-delivery/cloud-android.json).

Real two-account room message, sending idempotent, B1–B2 creation and sharing, room leaving permission and final room host exit pass. It takes 249ms/276ms for ordinary members/last room host to exit respectively, and both return business success and PENDING. Six minutes after stopping the room HTTP request, four persistent cleanup commands have not been executed and the room is ENDING; the message body has been cleared. See [Real room inspection](../acceptance/simplify-room-and-mobile-experience/production-room-smoke.json). Therefore the background convergence of the quick exit has not yet completed acceptance.

Confirmed code recovery gap: Seeding only occurs on app startup, with no request-triggered retries after the first failed send. The SDK's OIDC obtains tokens that depend on the request context or environment; starting seeding does not guarantee that the request context is available. Fixed seeding, concurrent merging, failed retries, and five-minute success cooldowns using in-request platform tracking to still perform persistent cleanup by private consumers. The specific cloud error category must be verified by reading Vercel logs and redeploying. Local pass cannot be regarded as the root cause for confirmation. Mac locks the screen again to prevent this log/PR operation.

Google remains closed. The AI_EXPRESSION/STT model and credential configuration are not found in the Vercel project variable list. The real translation is still waiting for the supplier configuration; do not select services or add keys without authorization. Physical device keyboard/two-machine audio is performed by the user, the complete native vision has not yet passed, and OpenSpec has not been archived.
