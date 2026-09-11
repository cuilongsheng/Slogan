# API Contract

`openapi/openapi.yaml` will be the sole published API contract once the first HTTP API is defined.

The generation mode is intentionally undecided until the Architecture stage chooses one:

- API-first: edit and validate `openapi.yaml`, then implement NestJS against it; or
- NestJS code-first: generate `openapi.yaml` from NestJS decorators and commit the generated contract.

Do not maintain a handwritten contract and a generated contract in parallel. This directory currently contains no placeholder contract because no API shape has been approved yet.

When the mode is decided, document the generation, validation, compatibility-check, and API-client commands here.

