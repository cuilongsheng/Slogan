# Vercel API and Pages integration — 2026-10-07

## API deployment

Production API: `https://slogan-api-pi.vercel.app`.

The deployment initially failed because Vercel's secondary TypeScript resolver
treated Helmet's default export as a non-callable module namespace. Loading the
callable CommonJS entrypoint with `createRequire` resolves the mismatch. The
`require` must be assigned before calling `require('helmet')` so Vercel's file
tracing includes the dependency in the function package; an inline call compiled
successfully but caused a runtime `Cannot find module 'helmet'` error.

Vercel-injected OIDC and proxy credentials, protection bypass headers, and signed
forwarding headers are now redacted from request logs. The redaction regression
suite passed all four tests.

Public production checks passed: auth capabilities returned 200 JSON, an
unauthenticated `/v1/me` request returned 401, and mobile CORS preflight returned
204 with the expected Pages origin. Password login is enabled; Google and email
are disabled. These checks do not establish account login, room, voice, worker,
or device acceptance.

## Pages routing correction

Pages keeps each frontend's own origin as its public API base so refresh cookies
remain same-origin. The worker needs `API_UPSTREAM_ORIGIN` set to the API origin
in both Production and Preview for both Pages projects.

The old worker accepted only Render hostnames. It therefore rejects the Vercel
origin with `503 API_PROXY_CONFIGURATION_INVALID`. The correction adds only
`slogan-api-pi.vercel.app` to the existing allowlist; unrelated Vercel hosts,
lookalike domains, URL credentials, paths, and non-HTTPS origins remain rejected.

Local evidence: 11 Pages tests passed, both frontend Pages builds passed, and
the packaged admin/mobile workers passed the workerd runtime smoke test.

Production Pages publication and public proxy verification remain pending until
this routing correction is merged into `main` and deployed. Existing preview
accounts and database contents were not changed.

The remote Pages Preview deployment of `cb810e2` succeeded for both projects.
Public `/v1/auth/capabilities` requests returned 200 JSON through both proxies:
`https://d0878922.slogan-preview-admin.pages.dev` and
`https://4b39ac21.slogan-preview-mobile.pages.dev`. An unauthenticated admin
preview `/v1/me` request returned 401. These are proxy transport checks; the
frontend bundles still target their production Pages origins, so full browser
login acceptance awaits production deployment. Both projects have the upstream
variable saved in Production and Preview; it takes effect on new deployments.

## Rollback

Revert the routing correction and restore the prior approved upstream only if
that upstream is operational. Redeploy both Pages projects after environment
changes. Do not rotate authentication secrets or provision accounts as part of
this rollback.
