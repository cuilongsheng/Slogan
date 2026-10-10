# direct-room-entry Specification

## Purpose

Allow users who are logged in and qualified to join to enter the ordinary voice room from the room list in one operation, cancel the fixed details, rule check and device check links; at the same time, clarify the recovery boundaries of necessary conditions such as passwords, voice processing authorization, room status changes, and system microphone permissions.

## Requirements

### Requirement: Click on the ordinary room to join directly

The system MUST enter the actual joining and connection process directly after the user clicks on the passwordless instant room card, no longer requiring details, independent rules confirmation, or equipment check pages. The system MUST retain backend qualification, status and capacity verification to avoid repeated navigation caused by repeated clicks.

#### Scenario: One click to join

- **WHEN** An eligible user clicks a joinable room card that requires no password.
- **THEN** The system directly joins, obtains real-time credentials and connects. After success, the voice room is displayed and the microphone is turned off by default.

#### Scenario: Status change or network failure

- **WHEN** The room is full, ended or the request failed after clicking
- **THEN** The system displays the relevant result with retry or return-to-list actions. It neither claims a successful join nor sends the user through fixed preparation pages again.

### Requirement: Only keep necessary entry conditions

The system MUST pop up the password input on the current room entry page for the password room; join directly after input, without going through the rules and equipment page. If required room-speech processing consent is missing, the system MUST reuse the explicit consent flow and MUST not silently consent on the user’s behalf. Existing valid consent must not be requested again. The system MUST automatically check microphone permission, available input devices, and audio playback while connecting. These checks do not introduce a fixed prerequisite page for muted entry; enabling the microphone still requires permission confirmation.

#### Scenario: Password to enter the room

- **WHEN** The user enters four digits for the password room and clicks to join
- **THEN** The system directly requests to join and let the backend verify the password. The wrong password can be corrected and tried again.

#### Scenario: Missing processing authorization

- **WHEN** The backend refused to join and stated that the required voice processing authorization for the room was missing.
- **THEN** The current check-in status displays the corresponding authorization entrance. After successful authorization, you can directly retry to join. If you refuse authorization, you can return to the list.

#### Scenario: Turning on the microphone for the first time

- **WHEN** The user who has entered the room turns on the microphone for the first time
- **THEN** The system handles platform permissions, remains silent and gives an error message when denied or the device is unavailable.

### Requirement: All instant room entrances use the same path

The system MUST route instant-room detail deep links, shares, invitations, and legacy rules/device/password paths into the same direct-entry session, preserving the invitation identifier without displaying fixed preparation pages. The system MUST not require re-viewing details or confirming rules due to page refresh or missing drafts.

#### Scenario: Legacy deep linking and sharing

- **WHEN** Qualified user opens instant room sharing, invitation, details or old preparation path
- **THEN** The system directly attempts to join. There is no additional confirmation when there is no password. Only the password pop-up window is displayed when there is a password.

#### Scenario: Wrong password

- **WHEN** The backend rejected the entered password
- **THEN** The system displays an error in the same pop-up window and allows modification and retry, without navigating the rules or device page.

### Requirement: Direct entry automatically checks devices and reports problems

The system MUST automatically check the microphone and audio without requiring manual preparation pages. Temporary audio probes MUST never be published, recorded, or uploaded, and their resources MUST be released on completion or cancellation. Members enter rooms muted by default. Permission denied, device missing, or playback unavailable MUST display a recoverable prompt.

#### Scenario: Permissions or audio issues detected

- **WHEN** User enters the room directly and device check finds permission denied, permanently denied, no input/output available, or playback blocked
- **THEN** Display corresponding problems and retry or open setting operations in the room, do not declare that the inspection has passed, and do not navigate to the preparation page

#### Scenario: Leave during a device check

- **WHEN** The user leaves while an asynchronous permission request or audio probe is still pending.
- **THEN** Results from the previous session are not written into a new session; temporary tracks are released and microphone audio is never published.
