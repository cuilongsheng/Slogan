# Optional profile details

Changes: gender, location and birth fields are optional; a supplied birth pair must be valid. First completion requires an unchecked explicit adult confirmation, recorded by the server. Known-underage birth information takes precedence and cannot be erased or changed to bypass the boundary. Existing adult profiles retain eligibility without fabricated assertion history. All room/share/social consumers use the profile policy.

## Visual and interaction evidence

Desktop Bridge verified the original Slogan `02 UI / Profile / 基本资料 · V2`, node `118:3095`, 390×844. The approved behavior adds optional/required labels, an unchecked adult checkbox, explicit birth-field labels and inline error flow. The source capture is [original-profile-118-3095.png](original-profile-118-3095.png). Browser captures use the real React Native Web profile components and isolated auth adapters, not a production Google identity.

- [English invalid form](invalid-en.png): the name error and adult error identify their own controls; focus moves to the name input.
- [English corrected form](corrected-en.png): optional fields remain blank, errors clear as values are corrected.
- [Chinese form](empty-zh.png): optional labels and explicit adult confirmation.

The original basic form does not contain the added birth input labels/error states. Extra content participates in scrolling. This evidence is a source-backed structure and changed-state review, not a claim of pixel identity across every new state or Android rendering. Native keyboard/focus behavior and full Google first-profile completion remain owner/device acceptance items.

- [Preferences errors](preferences-invalid-en.png): missing interests and CEFR each receive a message beside the relevant selection.

## Engineering evidence

API and mobile type checks, API compilation, admin build and generated OpenAPI/client completed. Added regressions cover omitted details, partial dates, adult assertion precedence, legacy profiles and field correction; suites were not executed under the owner instruction.

On 2026-10-11, `slogan-preview` received an AES-256-GCM authenticated PostgreSQL custom-format backup in owner-only local storage, then the three additive migrations. Existing private account records and credential hashes matched before and after. Backup authentication and archive header were verified; a database restore was not executed. Application rollback must retain nullable-field readers. See [operator guide](../../deployment/public-trial-accounts.md).
