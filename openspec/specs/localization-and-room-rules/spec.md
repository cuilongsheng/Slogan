# localization-and-room-rules Specification

## Purpose

Define the current version of the Chinese and English interface selection and room rule entry, so that users with different device languages ​​can understand the behavioral boundaries of the voice room. The joining process is defined by direct-room-entry.

## Requirements

### Requirement: Chinese and English interface selection

The system MUST use Chinese by default when the device language is Chinese, and English by default when the device language is not Chinese; the current version only provides Chinese and English copywriting.

#### Scenario: Chinese device language

- **WHEN** The user opens the app for the first time and the device language is Chinese
- **THEN** The system displays the Chinese interface by default

#### Scenario: Non-Chinese device language

- **WHEN** The user opens the app for the first time and the device language is not Chinese
- **THEN** The system displays the English interface by default

### Requirement: Rules entrance in the room

The system MUST retain accessible room rules entries after the user enters the voice room.

#### Scenario: View rules in the room

- **WHEN** Room members open the rules entrance
- **THEN** The system displays the behavioral rules of the voice room in the current interface language
