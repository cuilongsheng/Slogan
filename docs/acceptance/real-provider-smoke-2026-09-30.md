# Real service provider acceptance progress (2026-09-30)

This record only describes the external verification actually performed by this machine this time. The local test results of historical changes are not automatically upgraded to real service acceptance.

## 2026-10-01 Scope Clarification

The product owner has made it clear that real-time subtitles will not be displayed during real-person room communication; when an individual cannot express himself, he will take the initiative to hand over the native language content to a private auxiliary tool, and after obtaining the English explanation, he will speak. Neither basic LiveKit dual voice nor **Personal expression assistance for text input** rely on STT. The following STT blocking in this record only corresponds to short voice input, optional room-sensitive voice processing and post-meeting keywords in the existing OpenSpec, and does not block the current acceptance of the above two items.

Currently, `ai-expression-assistance` OpenSpec and mobile terminals still retain private short voice input; room-sensitive voice processing and post-meeting keywords have separate specifications. Whether to cancel these approved scopes shall be through subsequent OpenSpec revisions, and product requirements cannot be directly changed by this acceptance record.

## LiveKit Cloud

This machine `apps/api/.env` has been configured with the `wss://*.livekit.cloud` project and API credentials. Use the installed `livekit-server-sdk` and `@livekit/rtc-node` to create a randomly named isolation room in Cloud, and issue 5-minute tokens for two temporary identities according to the existing minimum grant of the application; two identities are connected at the same time and 2 people are returned by Cloud `listParticipants`. Then Cloud `removeParticipant` removed the first person, the client was disconnected and reconnection with the old token was refused; Cloud `deleteRoom` caused the second person to be disconnected, and the room queried by name was empty. All projects `listRooms` return 0 after cleaning. The script only outputs Boolean results and does not output keys, tokens, identities or room names.

This result proves that current Cloud credentials, server-side management operations, two RTC identity connections, and the old token revocation path are available. It does not post or listen to a real microphone track, does not go through Slogan's room authorization/API/database process, and does not prove a public network signed webhook. 6.1 of `implement-livekit-voice-session-backend` is still not complete due to these remaining conditions; the "no credentials configured" on 2026-09-12 in the relevant Cloud acceptance document is only the status at that time.

## Qualified STT dual voice

Currently `STT_PROVIDER_CATEGORY`, `STT_BASE_URL`, `STT_API_KEY`, `STT_MODEL`, `STT_REGION`, `STT_DATA_USE`, `STT_DELETION_MODE`, `STT_STREAMING_MODE` are not configured, `ROOM_SPEECH_DETECTION_ENABLED` and `POST_ROOM_KEYWORDS_ENABLED` are both `false`. Unable to start stealth detection, room host alarm, post-meeting keyword, consent withdrawal and downgrade two-person test that requires real STT. In addition to configuring connection parameters, you also need to confirm that the supplier zone, request processing only, no training, retention and deletion policies comply with the existing OpenSpec; you cannot just regard any compatible interface as "qualified". Two changes of 9.5 continue unfinished.

## iOS native

Xcode 27.0 and iOS 27.0 Simulator available. `xcodebuild` completes the native Debug build (`BUILD SUCCEEDED`) with `CODE_SIGNING_ALLOWED=NO` in the iPhone 18 Pro Simulator target; the generated `Slogan.app` has been installed into the starting simulator, `simctl launch` returns the process ID, and the screenshot shows the Expo development client homepage. The emulator pops up “Open in Slogan? "When the confirmation box appears, the Mac is locked and the JS page cannot be confirmed to run.

Native `security find-identity -v -p codesigning` returns 0 valid signing identities, `EXPO_APPLE_TEAM_ID` is not configured, and `devicectl` only lists emulated devices. Apple Team signed physical device testing and dual-device audio/disconnection acceptance cannot yet be performed. Simulator unsigned builds are no substitute for physical device evidence.

## SMTP

`EMAIL_PASSWORD_AUTH_ENABLED` is not enabled, the real `EMAIL_SMTP_*`, verify/reset link and mail HMAC/AES keyring have not been configured and there is no controlled real inbox evidence. No real email sent; 5.4 of `implement-email-password-auth-backend` continues unfinished. See [Mailbox operation instructions](../email-password-auth-runbook.md) for configuration and running sequence.
