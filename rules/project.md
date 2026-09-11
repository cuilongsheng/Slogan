# Project Rules

- Preserve authority boundaries from `AGENTS.md`; never silently resolve conflicting sources.
- Product behavior changes require OpenSpec unless they qualify as a Level 0 correction.
- Do not turn roadmap, advice, assumptions, or unresolved questions into requirements.
- Prefer the smallest implementation that completes the approved version scope.
- Keep secrets, provider credentials, tokens, phone numbers, email addresses, and raw private audio out of logs and repositories.
- Record consequential architecture choices; avoid speculative abstractions before a second real use appears.
- Before running Node.js or pnpm commands, activate the repository-pinned version from `.nvmrc` and verify it matches `package.json` engines; treat an ambient-version mismatch as an environment issue, not a code failure.
