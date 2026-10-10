## Why

The existing Figma file does not yet have product pages, tokens or components. It is necessary to first convert the new authentication entrance and first data initialization into a clickable mobile prototype, and use a low-cost method to verify the information level, form density and third-party login understandability.

## What Changes

- Design username, email and password registration, as well as username and password login portal for the mobile terminal.
- Design the interface status for email verification, resending verification email and email password retrieval.
- Design WeChat QR code login and Google account selection pop-up windows, including cancellation, failure, waiting and QR code expiration status.
- Design the first information filling page, covering avatar, display name, gender, nationality/city, interests, CEFR and date of birth.
- Create a minimal Token, Components, two main pages and necessary interaction variants in the `Slogan` Figma file that are only used for this round of prototypes.
- Visually borrows HelloTalk’s large white space, rounded cards, distinct main operations, and brisk hierarchy, but does not copy its brand, icons, illustrations, or specific page structure.

### Confirmed scope

- Two 390 × 844 mobile homepages: `Auth / Sign in`, `Profile / First setup`.
- Login page related overlays: registration, email to be verified, password retrieval, WeChat QR code, Google account selection and error status.
- Minimal design token, reusable components, prototype jump and visual acceptance screenshots.
- Chinese default interface, with scalable layout reserved for subsequent English copywriting.

### Non-goals

- Do not modify the mobile terminal, PC management terminal, server side or any business code.
- Do not create or modify OpenAPI, database, authentication service, mail service, OAuth configuration, `.env` or deployment configuration.
- The PC management terminal is not designed; its modern AI product backend style will be designed independently in the future.
- Does not implement mobile phone number, SMS verification code or account merging across login methods.
- This round does not create a complete product design system, but only creates the minimum basis for actual use of two pages.

### Unresolved decisions

- The production environment provider, email service and real configuration are left for future development changes; this round of Figma does not save or display the real keys.
- The restriction on the use of WeChat QR codes on a single mobile phone has passed the prototype description test. Whether to add the WeChat App native authorization entrance will not be decided in this round.

## Capabilities

### New Capabilities

<!-- There is no new capability this time. -->

### Modified Capabilities

- `identity-and-profile`: Clarify the email registration, username and password login, email retrieval, WeChat QR code and Google account selection behaviors that the prototype needs to express.

## Impact

- Impacted delivery stages：Prototype / Figma、Test / Acceptance。
- Figma: Currently connected `Slogan` file, two mobile main pages, login overlay, minimal Token and Components.
- Design record: Record Figma file/page/frame/node and visual acceptance evidence after confirmation.
