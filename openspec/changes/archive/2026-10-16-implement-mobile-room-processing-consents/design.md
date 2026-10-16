## Context

Backend creation and joining have required the current agreed versions of `ROOM_SAFETY_DETECTION` and `POST_ROOM_KEYWORDS` respectively; the interface only returns the status and version, and there is no description text issued by the server. The mobile terminal must present the data processing boundaries and purpose description specified by the current OpenSpec, and then allow the user to explicitly click to accept. The user has allowed pages that lack independent frames to inherit V2 styles.

## Goals / Non-Goals

**Goals:** House building is closed by default, independent selection, clearly displayed and independently agreed before joining, personal page withdrawal will be processed in the future, and server status errors are accurately displayed.

**Non-Goals:** does not automatically accept consent, does not save recordings/transcriptions, does not display sensitive identification content, and does not change room processing services or provider switches.

## Decisions

1. Two new Boolean values ​​are added to the house building form that do not affect each other. The default is false; submit an explicit Boolean value. The creation failed and the server prompts `*_UNAVAILABLE` and `*_CONSENT_REQUIRED`.
2. List/details use two Boolean values ​​on the server side, displayed before joining. The join rule page can only continue when the current consents of the enabled destinations are all `ACCEPTED` and the versions match; destination acceptance is clicked by the user, and if it fails, the same UUID is retained for retry with the same command.
3. The personal privacy page can be queried and withdrawn; the withdrawal will be sent to the current server-side description version, and it is assumed to have been withdrawn if it is not local. If the user is still activating the room, the backend will disconnect the corresponding processing/qualification, and the client will not treat it as the end of the room.
4. The description copy only describes the approved purpose: short-window temporary storage processing, no playback recording/complete transcription; anonymous keyword summary after the meeting; sensitive detection generates controlled risk signals but no automatic punishment. The server version number is used for command binding, and the page does not claim that the local copy is a server-side dynamic announcement.

## Risks / Migration / Rollback

- [Description of version update] → Obtain the current version from the server every time you enter the preparation page. The old version does not meet the continuation conditions; the room access control is maintained when the update is refused.
- [The room is still active when withdrawing] → Only the server results are displayed; the server is responsible for stopping future processing and session qualifications, and does not falsely report exit or end on the client side.
- [provider not ready] → The house building display is clearly unavailable, and existing real-person voices will not be affected.
- No data migration. The rollback only removes new forms and entrances, and the backend is still closed by default for both purposes; it does not revoke the consent audit fact that the user has explicitly submitted.
