## Why

The backend has provided personal restriction history and time-limited appeal API, but there is no entrance on the mobile phone. Users who are temporarily restricted cannot see the reason, deadline, or submit an appeal within the app.

## What Changes

- Add "My Restrictions and Appeals" to the personal portal on the mobile phone to read personal restrictions and stable paging history.
- Display reason input and submission for temporary restrictions that are still in the window and have not yet been appealed, and display pending/maintained/lifted results and server-side errors.
- Inherit the confirmed V2 components, colors and page density; this page does not have independent high-fidelity frames, the user has authorized the implementation according to the V2 visual language.

## Capabilities

### New Capabilities

- `mobile-safety-appeals`: Personal viewing and one-time limited appeal interaction on the mobile phone.

### Modified Capabilities

None. Existing `safety-restriction-appeals` backend behavior remains unchanged.

## Impact

- `apps/mobile` routing, personal entrance, API feature, copywriting and testing. Use existing `/v1/me/safety-restrictions` and `/{restrictionId}/appeal` without changing the data model or OpenAPI.
