## ADDED Requirements

### Requirement: Web page source API forwarding

Two web portals SHALL access the API with fixed deployment configuration through its own origin `/v1` and `/v1/*`; retain methods, paths, queries, request bodies, sources, authentication and status codes, and do not return API requests to page HTML.

#### Scenario: Login and refresh two websites

- **WHEN** Log in, refresh and exit through the management terminal or mobile web page.
- **THEN** HttpOnly session cookies are set, rotated or cleared under the corresponding website, and security attributes and paths are retained.
- **AND** The refresh token is not added in response to JSON, and the verification of the original Origin and Google redirectUri is not bypassed.

#### Scenario: Static page routing

- **WHEN** Accessing non-API pages or assets
- **THEN** Use website static asset processing, which does not consume the API forwarding path and does not require upstream configuration to be available

### Requirement: Fixed upstream and failsafe

Proxy SHALL only accesses HTTPS origins configured by operations and passed controlled upstream whitelist verification. The whitelist MUST retain single-layer `*.onrender.com` and approved `slogan-api-pi.vercel.app`, and MUST not release other Vercel projects, similar domain names, configurations containing credentials, paths, queries, fragments, or non-default ports. The proxy MUST prohibit caching API requests and responses, automatically replaying failed requests, using client forwarding/IP headers as trusted identities, or sending credentials to redirected external domains; the proxy's own error SHALL is desensitized JSON.

#### Scenario: Configuration or transfer failed

- **WHEN** Fixed missing/invalid upstream configuration, network failure or first packet timeout
- **THEN** Returns corresponding 503/502/504, disables caching and does not disclose upstream details, request body or credentials
- **AND** The request is not automatically retried

#### Scenario: Source and cookie boundaries

- **WHEN** Untrusted web page source attempts authentication or upstream returns unsafe redirect/Cookie with Domain
- **THEN** Existing origin refused to remain valid, proxy refused to expand the scope of the cookie or forward credentials

### Requirement: Two stations can be built repeatedly

Release builds for both websites SHALL include executable proxies and explicit API routes from source, using only their respective full HTTPS origins as public API bases, and disallowing credentials from entering the public configuration.

#### Scenario: Final release product

- **WHEN** Run any website Pages build
- **THEN** Output includes pages, assets, same proxy implementation and routing configuration that only overrides the API
- **AND** Missing or illegal public base failed explicitly before building
