# Room usability follow-up

## Why

The owner observed an oversized desktop voice preview, outdated rule text structure, missing avatars, unnecessary sharing screens, an incorrectly light unavailable assistance sheet, silent invitation controls, repeated device prompts, and slow recovery.

## What changes

Unify list/voice web bounds at 402 × 874 logical pixels (standard iPhone 17), preserve smaller viewports and native safe areas; restore the inline Figma banner; add two cartoon defaults with broken-image fallback; copy share URLs directly; use a dark disabled assistance sheet; explain host-only invitations; reuse successful microphone probes only while permission remains valid; preserve one unlocked Web Audio context; parallelize room/member refresh after SDK reconnection.

## Impacted delivery stages

- Architecture: audio resource lifetime and recovery safeguards
- Prototype / Figma: original room 115:1425, invitation 111:884, new authorized dark/disabled and cartoon assets
- Backend / API: public default-avatar variants; no new personal profile field
- Frontend
- Test / Acceptance
- Deployment

## Scope

User items 1–8 only. Item 9 (Partners) was explicitly withdrawn. Existing upload/provider avatars, host-only invitation authorization, muted entry, reporting, admission, and terminal exit rules remain authoritative.
