## Purpose

Define the observable process for qualified mobile users to learn about the room from the public real-time room list and complete the pre-check-in check, ensuring that the page only displays real information from the server, and does not occupy member quotas when the voice session has not been connected.

## ADDED Requirements

### Requirement: Qualified users can browse public real-time rooms

The system MUST allow users who have completed their profile and meet age qualifications to browse the public instant rooms returned from the server through the default entrance. The list MUST support refreshing and existing cursor paging, distinguishing between loading, empty list, retryable error and result status; users with incomplete information or age restrictions MUST not be able to access this entry.

#### Scenario: List loaded successfully

- **WHEN** The qualified user opens the room list and the server returns the public room
- **THEN** The page displays the real theme, CEFR, room host nickname, number of people/capacity, remaining time, password status and sensitive speech recognition status, and does not display static sample rooms

#### Scenario: List is empty or loading failed

- **WHEN** The server returned an empty list or the request failed
- **THEN** The page displays understandable empty status or retryable errors respectively, and does not forge the number of rooms.

#### Scenario: Refresh and paging

- **WHEN** The user refreshes the list or loads the next page
- **THEN** The page uses the current query context to re-request or return the corresponding cursor, does not repeat the existing rooms and does not refer to the loaded number as the total number of servers.

### Requirement: View room details before checking in

The system MUST allow qualified users to view the details of rooms they are allowed to access and display the joining conditions based on the latest server results. The page MUST distinguish the status of full membership, end, password and room host reconnecting from the status of continued operation; unacquired membership or avatar MUST not be filled with fictitious content.

#### Scenario: View available rooms

- **WHEN** User opens accessible room from list
- **THEN** The page reads room details, displays the real room attributes and current number of people, and enters the corresponding pre-room entry process based on the password status.

#### Scenario: Room is unavailable during viewing

- **WHEN** Detailed reading shows that the room does not exist, is over, is full, or is temporarily unavailable to join.
- **THEN** The page explains the reason and provides a return list or retry entry, without claiming that the user has joined.

### Requirement: Preparation for passwords and rules before entering the room

The system MUST collect exactly 4 digits for password rooms as temporary input for the current room entry process; the password page MUST be skipped for non-password rooms. The system MUST display the complete room entry rules in the current interface language and require the user to actively check before continuing the equipment check. The page MUST not claim that the password has been verified or that the rules have been accepted by the server when a join request has not been submitted to the server.

#### Scenario: Fill in the password for the password room

- **WHEN** The user entered a non-4-digit number or a 4-digit number in a valid format for the password room
- **THEN** The page blocks continuation or allows entry to the rules page respectively, and the password does not appear in the URL, logs or persistent storage

#### Scenario: Actively confirm rules

- **WHEN** The user did not check the rule confirmation or actively checked the confirmation
- **THEN** The page prevents continuing or entering the device check respectively; the previous confirmation no longer applies after changing the target room

### Requirement: Equipment check does not allow joining the room in advance

The system MUST read or request microphone permission when the user explicitly requests a check, and distinguish between allowed, denied, and device unavailable states. When there is no available voice room client in the current batch, the device check page MUST clearly inform that actual room entry is temporarily unavailable, and MUST not call the interface for creating membership or real-time credentials.

#### Scenario: Microphone available

- **WHEN** The user actively completes the microphone permission and device check and the results are available
- **THEN** The page shows the ready status and clearly states that it has not yet entered the voice room or occupied the quota.

#### Scenario: Microphone rejected or device unavailable

- **WHEN** Microphone permission denied, permanently denied, or available input cannot be detected
- **THEN** The page displays the corresponding recovery path and does not falsely report the device status as ready.
