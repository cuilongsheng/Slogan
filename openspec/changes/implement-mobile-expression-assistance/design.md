## Context

It has been confirmed that Figma `115:1627`, `115:1673`, and `115:1720` are the voice elastic layer start, listening, and result states respectively, all of which are 390×844. OpenAPI already has text and multipart audio interfaces and consent status/commands. The current voice room only has unavailable seats. The server stated that the version was controlled by `ASSISTANCE_NOTICE_VERSION` but was not returned in the first consent state.

## Decisions

1. The voice elastic layer inherits the current `VoicePage` and StyleSheet tokens; the voice room host body layout is not changed. Text input and error status follow the same bottom pop-up visual language as a status record that is not covered separately by the design draft.
2. Agree status response increased by `currentNoticeVersion`. The client only uses the server return value, reads the consent status first, and then actively ACCEPTs; the withdrawal can be completed from the same elastic layer. Each audio submission requires separate confirmation. `noticeConfirmed=true` will only be sent after the user confirms this time.
3. The recording is packaged by the `expo-audio` platform service. Wait for the LiveKit local microphone to be turned off before starting recording; recording stop, cancellation, component unloading and room end all release resources. Maximum 30 seconds per segment; check file size and MIME type before submission. The results are only kept in the elastic layer memory.
4. Generate UUID for each input. The network or server can retry and retain the original input/audio and UUID; edit the input or re-record to generate a new UUID to avoid idempotent conflicts. The audio file will only be retried this time, and the reference will be discarded when the elastic layer is closed.
5. API returns 429, 503, displays clear text when consent expires or permission fails, and does not change room status, wheat position or real-time media. The result must display a possible AI error message and will not play automatically.

## Risks and rollback

- There are platform differences when connecting to LiveKit and device recording at the same time: turn off the room microphone before requesting device recording, and the native dual device acceptance is recorded independently. Keep the room microphone off on failure to avoid accidental disclosure of private words.
- When the Provider is not configured or the budget is turned off, text/voice input and retry operations are retained, and room voice continues to be available.
- API field added for backward compatibility; ignored by old clients. Rolling back the front-end entry does not affect existing consent and result records.
