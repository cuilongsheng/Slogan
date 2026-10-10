# Mobile private expression auxiliary acceptance record (2026-09-28)

## Goals and Realization

- Figma Desktop Bridge has confirmed `115:1627` (start), `115:1673` (listening), and `115:1720` (English results), all of which are 390×844 V2 voice room elastic layers. The voice portal uses these three layouts; text, first consent, current confirmation and error status follow the same visual language and are not independent high-fidelity frames.
- Current voice room members can enter short voices from the top auxiliary entrance and enter text from the bottom input area. Text requests do not require voice consent. The audio first obtains the current description version of the server and requires active acceptance; confirm again before uploading each recording.
- Private recording up to 30 seconds; turn off LiveKit room microphone before starting. The audio is only submitted as a multipart private request, and the generated results are only displayed in the local pop-up layer and are not automatically played or broadcast. Both text and audio retain the request UUID for retry if the same content fails.
- The consent status is newly returned to `currentNoticeVersion`, and the current version is provided by the server. OpenAPI and build client are synchronized.
- The accepted voice processing consent can be withdrawn in the same pop-up layer; the text result of "Say one more sentence" returns to text input, and the voice result returns to the recording entrance.

## Verification performed

- API full set of E2E: 16 groups, 85 tests passed; first consent status assertion current specification version.
- Full set of Jest for mobile phones: 27 groups, 80 passed tests; covering agreed versions, text and multipart requests, retrying with the same input, and room microphone isolation before recording.
- Mobile phone lint, typecheck, and iOS JavaScript export passed; OpenAPI and client generation checks passed.
- Create an instant room with a local real account and enter LiveKit; the audio entry shows the first use consent, but the text entry does not require audio consent. The text request hits the local API. Because the current `ASSISTANCE_ENABLED=false` return service is unavailable, the page prompts and the room has not exited. The test room then ended normally.

## Still needs acceptance

- On this machine `ASSISTANCE_ENABLED=false`, `ASSISTANCE_AUDIO_ENABLED=false`, no real AI/STT call occurred; the runtime status of successful results, quota exhaustion and audio processing failure only has automation and code evidence. When opening, a real provider that complies with the existing data policy needs to be configured, and simulation results cannot be used instead.
- Recording permissions, 30-second auto-stop, multipart native upload, coexistence with LiveKit audio sessions, front and back interrupts, and resource release not verified under iOS/Android development build or dual device. `expo export` only proves that the JavaScript bundle can be built.
- The start, listen and result states in the three V2 drafts are still missing 390×844 browser frame-by-frame screenshots; the current real account has not agreed to voice processing and has not accepted the privacy statement on behalf of the user. Cannot claim 1:1 or complete native device acceptance.
