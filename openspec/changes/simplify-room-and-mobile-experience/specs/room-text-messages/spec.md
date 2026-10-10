## Purpose

Define the behavior of sending ordinary text messages and scrolling display at the bottom of the voice room, so that current members can communicate through real messages and clearly isolated from the input and results of private English expression translation.

## ADDED Requirements

### Requirement: In-room synchronization control request frequency

Room messages MUST be read incrementally, active chats use two seconds for synchronization, and consecutive empty pages are gradually backed off to ten seconds; local transmission is displayed immediately and fast synchronization resumes. Failed retries MUST back off to a maximum of thirty seconds. Background/exit MUST stop message requests, and the foreground resumes immediately filling in from the cursor. Room details/members MUST be merged and refreshed in progress and only remain in the foreground for fifteen seconds. Member events can trigger server-side verification.

#### Scenario: Idle and front-background switching

- **WHEN** There are no new messages in the room continuously, and then the application enters the background and returns to the foreground.
- **THEN** Idle polling gradually decreases, there are no periodic requests in the background, and the frontend is completed immediately without creating a repeat timer.

#### Scenario: Synchronize after sending

- **WHEN** User successfully sent text in free room
- **THEN** Your own text is displayed immediately, incremental synchronization restores fast frequency and does not repeat concurrent GET

### Requirement: Send normal text to the current room

The bottom of the room MUST provide ordinary text input and sending operations. Effective messages MUST display the sender and content and allow other qualified members of the current room to receive them; the message area MUST support scrolling. This input MUST not trigger AI expression assistance.

#### Scenario: Two members send a message

- **WHEN** Members in the room send valid ordinary text
- **THEN** This message is displayed in the room message area between myself and another current member and can be scrolled.

#### Scenario: Blank or repeated

- **WHEN** The input is blank or the same send operation is submitted repeatedly
- **THEN** Blank does not generate a message, and the same operation does not display multiple duplicate messages.

### Requirement: Room message has member boundaries

The system MUST verify the current membership of the message sent and read. Exited or removed members may not continue to send or read. The message MUST not contain other users' private translation results.

#### Scenario: Exited member request message

- **WHEN** Exited members bypass the page to send or read room messages
- **THEN** The system rejects the request and does not disclose room information
