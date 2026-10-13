# Design

## Targets and contracts

Figma Desktop Bridge file 56nIowZmvBhb0QJvOlDQdU / 02 UI (102:2766), room 115:1425 (390×844), inline rules 199:2769; invite 111:884. Original frames are preserved. The user explicitly authorizes 402×874 web bounds, cartoon assets and dark assistance colors. Native screen dimensions are unchanged.

Room detail/members and invitations use existing generated OpenAPI contracts. The stable shareUrl is already admitted; copying performs no network request. Extend remains reachable through the host's remaining-time label, and the host power action ends directly; member power exits directly. The three-action overflow remains report/leave/copy.

## Audio and recovery

A process-scoped successful microphone probe may be reused for at most five minutes, only after a fresh lightweight OS/browser permission read. Permission changes, device changes, actual capture failure, or explicit retry invalidate the probe. No microphone track is retained or published by this cache. Native automatic entry checks may request permission only when its status is undetermined; an existing denial is shown without repeatedly opening the OS prompt. Explicit microphone/retry actions may request again when the OS permits it. Returning from settings performs a non-forcing refresh. Output capability is checked independently, and Web requires both SDK canPlaybackAudio and a running shared AudioContext. Native uses AudioSession startup and output capability: browser autoplay status is not a native permission signal.

A shared browser AudioContext is resumed synchronously from a captured click/tap and supplied through the SDK's supported webAudioMix option. This resource survives room navigation; SDK room/listeners/tracks do not. Failure still displays a localized enable-sound action. Native AudioSession lifetime remains owner-counted. No fake permission flag or localStorage audio approval is used.

LiveKit retains reconnect ownership and its default bounded backoff, including immediate browser online recovery. Application room detail and member refresh run concurrently, with existing generation/exit fencing and one coalesced refresh. Transient SDK reconnection keeps the same room body mounted and shows an inline status, preserving chat and open controls. No additional token request or new Room is triggered by reconnect. Only an explicit retry after SDK terminal network disconnection re-admits and obtains fresh credentials. Recovery duration and host grace deadline are different measurements; no speed claim is made from a screenshot countdown.

## Defaults and privacy

Serve male/female public PNG variants through the existing default-avatar endpoint using a validated optional variant query. Only an explicit female profile chooses the feminine variant; other/omitted gender uses the masculine illustration as a generic visual default, without storing or claiming a gender. Existing customized/provider images stay preferred. Failed image loads use a bundled cartoon instead of an empty seat. No private gender field is added to room DTOs.

## Risk, migration and rollback

No schema migration. Audio mixing changes only Web and can revert independently; native uses existing audio primitives. Remove shared-context wiring to restore SDK-owned contexts if playback regressions appear. Default route without a variant remains compatible. Browser autoplay may still require a new gesture after browser suspension/reload; never hide an actual failure. Device acceptance needs actual Android/network/audio evidence, not fixtures.
