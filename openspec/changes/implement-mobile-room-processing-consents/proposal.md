## Why

The room API supports two independent purposes: sensitive speech recognition and post-meeting keywords. However, it is not possible to explicitly select the room when building a room on the mobile phone. The room display is incomplete, and there is no corresponding independent consent entrance when joining the activated room. The user is therefore unable to use the implemented server capabilities.

## What Changes

- When building a house, select two voice processing purposes respectively, both of which are turned off by default; the room list and details are displayed on the server side before joining.
- Read my consent status before entering the room, and the user actively accepts the current version of instructions respectively; without consent, you cannot continue to join.
- The personal page provides purpose-independent consent status and withdrawal entrance; withdrawal only affects future processing.
- When the real provider is not enabled or not ready, the server-side unavailable status is displayed, and no summary or security detection is faked.

## Capabilities

### New Capabilities

- `mobile-room-processing-consents`: Independent agreement on the selection and use of room voice processing on the mobile phone.

### Modified Capabilities

None. Follow the current room speech processing and post-meeting keyword specifications and OpenAPI.

## Impact

`apps/mobile` House construction, discovery, preparation for moving in, personal page, API feature, copywriting and acceptance. The backend permissions and persistence structure remain unchanged.
