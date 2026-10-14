## ADDED Requirements

### Requirement: Optional Android release discovery
The controlled Android app SHALL discover newer published releases without blocking startup or interrupting a room or voice call. The app SHALL offer a manual update check in Me. Automatic checks SHALL be rate limited, and Later SHALL suppress repeated prompts for the same version during the current app session.

#### Scenario: A newer compatible release exists
- **WHEN** an idle Android app discovers a compatible release with a higher versionCode
- **THEN** it offers the release version, download action and Later
- **AND** it continues to work if the user declines

#### Scenario: Current or unavailable release
- **WHEN** the latest release is current or an automatic check fails
- **THEN** the app continues without a blocking screen
- **AND** a manual check communicates current-version or recoverable failure feedback

### Requirement: Verified user initiated APK download
The app SHALL download only the selected immutable release after an explicit user action, show transfer progress, support cancellation and reject mismatched bytes, digest, package, version, certificate or ABI. It SHALL not expose incomplete files to the installer.

#### Scenario: A download completes
- **WHEN** a user downloads a newer release successfully
- **THEN** the app verifies the downloaded APK against the selected release and installed application identity
- **AND** only a verified APK becomes installable

#### Scenario: A transfer fails or is interrupted
- **WHEN** transfer fails, is canceled or the user enters a room or call
- **THEN** the transfer stops and incomplete bytes are discarded
- **AND** the installed app and room/call behavior remain usable

### Requirement: System controlled installation
The app SHALL open Android's installation flow only after explicit user consent. If Android requires install-source permission, the app SHALL explain it and open the per-app settings upon a user action. Returning with permission granted SHALL continue installation; denial or canceled installation SHALL remain recoverable. The app SHALL determine installed version from the actual package rather than claiming success from installer launch.

#### Scenario: Permission is missing
- **WHEN** installation requires permission to install from Slogan
- **THEN** the user can open system settings or postpone
- **AND** declining permission does not block the app

#### Scenario: Installation is canceled
- **WHEN** the user cancels the system installer
- **THEN** the app allows installation to be retried or postponed
- **AND** it does not mark the update as installed

### Requirement: Platform and bootstrap boundary
Web, iOS and Expo Go SHALL not invoke Android update operations. An APK without the updater SHALL require one manual installation of an updater-enabled release before future update prompts are available.

#### Scenario: Unsupported platform
- **WHEN** the app runs on web, iOS or Expo Go
- **THEN** it does not check or display the controlled Android installer flow
