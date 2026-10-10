## Purpose

Defines long-lasting one-on-one text conversations between adults, as well as recent conversations, friend entries, personal history and safety boundaries of the "message" portal, allowing users to naturally enter sustainable private communication from idle partner discovery.

## ADDED Requirements

### Requirement: Qualified users can directly initiate text chats

The system MUST allow qualified users to send text messages to another qualified user from the visible idle partner or existing friend portal, without requiring the recipient to accept or establish a friend relationship in advance; when sending, MUST re-verify the accounts, ages, information, security restrictions and blocking of both parties in either direction, and may not send to themselves.

#### Scenario: Send first message to an idle stranger

- **WHEN** User selects visible eligible free strangers and sends valid text
- **THEN** The system establishes a unique two-party conversation, saves the message, and allows both parties to see the conversation in their own "message" entrance.

#### Scenario: The existing session object is no longer free

- **WHEN** The two parties already have a conversation and the recipient no longer appears in the idle partner list, but still meets the sending qualifications
- **THEN** The sender can still continue the text exchange from his own conversation history

#### Scenario: Qualification expired when sending

- **WHEN** The target is blocked by any party, the account is restricted, or other sending qualifications are invalid.
- **THEN** The system rejects new messages and does not reveal the target’s specific privacy status.

### Requirement: Text history is retained across logins and is only visible to participants

The system MUST persist valid text messages and return them in paging in a stable order. Only the two parties in the conversation can view their own visible history. The send operation MUST be safely retried by the caller request identifier, and repeated requests MUST not produce duplicate messages; messages that are blank or exceed the product length limit MUST be rejected.

#### Scenario: Log in again to read history

- **WHEN** A session participant opens the session on another device or after the next login
- **THEN** The system returns historical messages in order that are still visible and cannot be read by other users.

#### Scenario: Send retry

- **WHEN** The caller retried the same canonical message with the same request ID.
- **THEN** The system returns the original message; a conflict is returned when the reuse identifier changes the session or content.

#### Scenario: Invalid text

- **WHEN** User sends text that is blank or exceeds the published length limit
- **THEN** The system returns a verification error and does not save the message

### Requirement: Message entry distinguishes recent conversations and friends

The system MUST display my recent conversations and their unread status in the "Message" portal, and provide an portal for my friends. Friends who have not chatted with you cannot pretend to have existing conversations; users who have chatted with you but are not friends can appear in my recent conversations. Lists and details must not reveal other people's friendships or conversations.

#### Scenario: No news from friend yet

- **WHEN** User opens Messages and a friend has never established a text conversation with them
- **THEN** This friend can be found in the friends portal, but does not appear as a recent conversation with fake previews

#### Scenario: Already have a conversation with a stranger

- **WHEN** User has exchanged valid text messages with non-friends
- **THEN** This conversation appears in my recent conversations without first establishing a friend relationship.

### Requirement: Deleting a session only affects the operator's visible history

The system MUST allow participants to delete visible content from the session from their own message lists and histories, and may not delete or revoke the other party's history on behalf of the other party. Conversations can reappear when there are new messages after deletion, but old content that has been deleted by this user must not be automatically restored to its visible history.

#### Scenario: Unilateral deletion

- **WHEN** One party deletes its own conversation history
- **THEN** Its list and details no longer show old messages, the other party's visible history remains unchanged

#### Scenario: New message received after deletion

- **WHEN** Users whose history was deleted later received eligible new messages
- **THEN** The conversation reappears in its list, showing only the messages visible after removing the boundary

### Requirement: Text communication with strangers has a controlled and safe entrance

The system MUST impose server-side anti-abuse restrictions on strangers' first messages and consecutive messages, and allow recipients to block each other in the conversation or report specific messages. The reported content only enters the authorized security processing process and does not automatically reveal the reporter to the person being reported or impose penalties.

#### Scenario: High frequency strange messages

- **WHEN** The sender exceeded the published limit for unknown messages.
- **THEN** The system rejects over-limit sending, returns understandable retry feedback, and does not save the rejected message.

#### Scenario: Recipient reports message

- **WHEN** Conversation participants select a message visible to themselves and submit a valid report
- **THEN** The system saves traceable security cases, and the ordinary conversation interface does not expose the reporting identity or text.
