## MODIFIED Requirements

### Requirement: Message entry distinguishes recent conversations and friends

The system MUST display my recent conversations and their unread status in the "Message" portal, without a separate Friends tab. Friends who have not chatted with you cannot pretend to have existing conversations; users who have chatted with you but are not friends can appear in my recent conversations. Lists and details must not reveal other people's friendships or conversations.

#### Scenario: No news from friend yet

- **WHEN** User opens Messages and a friend has never established a text conversation with them
- **THEN** This friend does not appear as a recent conversation with fake previews; removing the tab does not remove the existing friendship or its management records

#### Scenario: Already have a conversation with a stranger

- **WHEN** User has exchanged valid text messages with non-friends
- **THEN** This conversation appears in my recent conversations without first establishing a friend relationship.

#### Scenario: Simplified recent list

- **WHEN** a participant opens Messages
- **THEN** only recent conversations are listed with a View action and their unread status, without a Friends tab or redundant page subtitle
