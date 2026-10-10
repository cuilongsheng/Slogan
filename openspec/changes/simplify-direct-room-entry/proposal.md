## Why

The user explicitly requested to click on the room to join. Three fixed pages of current details, rules, and equipment inspection allow repeated confirmation of ordinary room entry. The user then requested to keep the automatic microphone and audio check when entering the room, and found a problem prompt; what was canceled was the manual preparation page.

## What Changes

- The ordinary room card directly enters the voice room and performs actual joining; cancels fixed details, rule check and equipment check path.
- **BREAKING** no longer uses a separate rule confirmation page as a prerequisite for each room entry; retains the rules entry in the room, clicks to join to express the intention to enter the room, and is compatible with the existing rulesAccepted contract.
- The password room only retains necessary password input; existing voice processing authorization is used. If authorization is missing, the necessary processing authorization is provided in the current room entry status, and the user's consent is not automatically granted.
- Keep the default mute when entering the room, automatically check microphone permissions, available inputs and audio output/playback status when connecting. Temporary tracks are only detected and released, not published or uploaded; rejection/permanent rejection/device unavailability prompts in the room and provides retry/settings, and the actual opening of the microphone still confirms the permission.

## Capabilities

### New Capabilities

- `direct-room-entry`: Room card entry, necessary conditions and failure recovery in one operation.

### Modified Capabilities

- `localization-and-room-rules`: Cancel the confirmation page before entering the room alone and retain the rules in the room.

## Impact

Mobile room-discovery, voice-room navigation, adding drafts and error recovery. Continue to use only OpenAPI and build clients, no migrations, credentials or vendor changes. The backend automatic deployment configuration description belongs to the existing deployment record, and no new deployment topology will be added.

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance
- Deployment

## Scope boundaries

The confirmation scope comes from the user's direct room entry request on 2026-10-09 and the existing submission/PR delivery authorization. Password, account qualification, capacity and processing authorization continue to be verified by the backend; room reservations continue to use reservation semantics. iOS, automatic production database migration and supplier switching are outside the scope of this article.

2026-10-09 The user requested to complete the queuing tasks first and suspend the release; the latest additions will be kept locally and no new PR, push or release APK will be created.
