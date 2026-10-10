## Purpose

Define the current version of Chinese and English interface selection and confirmation of safety rules before entering the room, so that users with different device languages can understand and actively confirm the behavioral boundaries of the voice room.

## ADDED Requirements

### Requirement: Chinese and English interface selection

The system MUST use Chinese by default when the device language is Chinese, and English by default when the device language is not Chinese; the current version only provides Chinese and English copywriting.

#### Scenario: Chinese device language

- **WHEN** The user opens the app for the first time and the device language is Chinese
- **THEN** The system displays the Chinese interface by default

#### Scenario: Non-Chinese device language

- **WHEN** The user opens the app for the first time and the device language is not Chinese
- **THEN** The system displays the English interface by default

### Requirement: Confirm safety rules before entering the room

The system MUST display the rules prohibiting topics or behaviors such as politics, pornography, gambling, drugs, illegal economic activities, personal attacks, harassment, discrimination, and threats in the current interface language before the user enters the voice room, and require the user to actively confirm.

#### Scenario: User confirmation rules

- **WHEN** Users who are eligible to join confirm that they have read the rules
- **THEN** The system continues to perform microphone check and room entry process

#### Scenario: User refuses to confirm rule

- **WHEN** User did not confirm or refused to confirm the rule
- **THEN** The system cannot add it to the voice room

### Requirement: Rules entrance in the room

The system MUST retain accessible room rules entries after the user enters the voice room.

#### Scenario: View rules in the room

- **WHEN** Room members open the rules entrance
- **THEN** The system displays the rules again in the current interface language with the same meaning as before entering the room.
