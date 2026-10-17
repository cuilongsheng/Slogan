## ADDED Requirements

### Requirement: Main-page typography and personal navigation follow the owner correction

Partners and Messages MUST use centered 16px titles. Me MUST retain a centered 16px page heading with avatar, display name and language controls below it, compact left-aligned menu actions and a bottom logout action. Me MUST offer a My reports entry opening the authenticated reporter's own complaint history.

#### Scenario: Main headings and personal content
- **WHEN** the user opens Partners, Messages or Me
- **THEN** the first two headings are 16px, Me has a centered 16px heading, and its personal actions use compact left-aligned rows and include My reports


### Requirement: Standalone large mobile actions use the confirmed geometry

Standalone large page actions MUST be centered and measure 342 by 46 logical pixels at a 390-pixel viewport. They MUST shrink to fit narrower containers without horizontal overflow, preserving 24-pixel page margins. Compact list actions, icon buttons and paired call controls retain their separate design sizes.

#### Scenario: Page action on standard and narrow viewports
- **WHEN** the user opens login, room creation or personal logout at standard or narrow mobile widths
- **THEN** the action is 342 by 46 when space permits and retains its 46-pixel height while fitting the available width
