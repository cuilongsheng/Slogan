## Why

The expression assistance entrance to the speech room still shows "open for follow-up", but currently OpenSpec and OpenAPI have specified text, short speech, consent and private results. User cannot use implemented backend capabilities.

## What Changes

- Connect the voice room expression auxiliary entrance to text and short voice input of up to 30 seconds, and restore the voice elastic layer by pressing V2's start, listen, and English results three 390×844 design drafts.
- The first audio processing shows clear purpose consent, and is confirmed again every time the audio is submitted; text input does not require voice consent. The results are only displayed on the requester's computer and are not automatically played or posted to the room.
- Add a read-only API field for the current audio description version, allowing the client to submit the current version without copying the server configuration.
- Provide recoverable status for permissions, quotas, provider failures and network retries; turn off the room microphone before recording to avoid private input being broadcast at the same time.

## Capabilities

### New Capabilities

- mobile-expression-assistance: Voice room private text/short voice expression auxiliary interface.

### Modified Capabilities

- temporary-speech-processing: Agree to publish the current description version.

## Impacted delivery stages

- API contract
- Frontend
- Test / Acceptance

## Impact

Affects `apps/mobile` voice room and recording services, `apps/api` consent response DTO, `openapi/openapi.yaml` and generated clients; no database migration. Native devices and real AI/STT providers need to be accepted separately.
