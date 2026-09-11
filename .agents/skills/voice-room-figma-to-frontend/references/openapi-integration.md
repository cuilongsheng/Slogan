# OpenAPI Integration

## Contract Boundary

`openapi/openapi.yaml` is the sole API contract once created. Read `openapi/README.md` to learn whether Architecture selected API-first or NestJS code-first generation. The frontend workflow consumes the resulting contract the same way in either mode.

Do not infer endpoints, fields, enums, permissions, pagination, or errors from Figma.

## Capability Audit

For every screen action, record:

- operation ID, method, and path;
- path/query parameters and request body;
- response and error shapes;
- authentication and authorization requirements;
- pagination, upload, streaming, or realtime behavior;
- generated client/type availability.

Classify each action:

- `READY`: contract and usable client behavior exist.
- `PARTIAL`: contract exists but lacks a required field, state, or integration.
- `MISSING`: no approved contract exists.
- `BLOCKED`: a dependency prevents reliable integration or verification.

Visual implementation may continue with an explicitly approved mock or established mock layer. Otherwise leave missing integration visible in the delivery report rather than simulating production success.

## Conformance

- Prefer generated or centrally derived clients and types.
- Do not duplicate DTOs or enums in page modules.
- Treat contract drift as a Backend/API issue requiring the appropriate OpenSpec change.
- Verify errors and permissions, not only successful responses.

