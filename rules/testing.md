# Testing Rules

- Use Playwright for end-to-end browser flows and admin-web acceptance.
- Add lower-level tests where they provide faster evidence for domain rules, permissions, concurrency, and adapters.
- During implementation, run the smallest relevant tests and checks after each coherent change instead of repeatedly running the full affected-scope suite.
- Run the full affected-scope verification once after all implementation tasks in an OpenSpec change are complete. Run it again only when it fails, later edits can invalidate its evidence, or CI, merge, release, or explicit acceptance policy requires a fresh result.
- After a failed full verification, iterate with the smallest failing scope first, then rerun the full affected-scope verification once before recording final evidence.
- Tests/CI are verification evidence, not the sole product acceptance authority.
- Match evidence to risk: UI requires visual/runtime checks; microphone, reconnect, permissions, and device-language behavior may require real-device evidence.
- Never mark an unexecuted check as PASS. Distinguish introduced failures from pre-existing or environment-blocked failures.
- Keep fixtures deterministic and free of real credentials or personal data.
