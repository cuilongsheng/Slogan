## ADDED Requirements

### Requirement: Room usability and honest audio readiness

The client MUST bound desktop voice and discovery previews consistently, preserve four seats per row, display the approved inline rules, provide visible default avatars, copy the existing room share URL in one action, and render unavailable expression assistance as a dark disabled sheet. Host invitation controls MUST open the in-app picker immediately; non-host attempts MUST explain the permission restriction without issuing an invitation.

#### Scenario: One-click room link

- **WHEN** a member selects share room link
- **THEN** the client copies the existing URL without a share sheet or API request and displays success or failure

#### Scenario: Re-enter after a successful device check

- **WHEN** the user re-enters within the bounded cache period with unchanged granted permission
- **THEN** the client reuses the successful microphone probe without capturing again, remains muted, and still reports actual capture/output/playback failures

#### Scenario: Permission or device changes

- **WHEN** permission is revoked, a device changes, or capture fails
- **THEN** cached probe success is invalidated and an actionable localized device notice is shown

#### Scenario: SDK recovers transport

- **WHEN** LiveKit reconnects the existing session
- **THEN** the existing room body stays visible with inline recovery status and application room and member refresh run concurrently without requesting credentials or rebuilding the SDK room, while ended/removed membership still exits safely
