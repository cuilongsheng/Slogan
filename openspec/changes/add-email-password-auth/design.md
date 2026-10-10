## Context

See Why of `proposal.md`. The currently connected `Slogan` Figma file is only a blank `Page 1`, with no local variables, styles, components or pages; there are only a few basic neutral colors, spacing, rounded corners and font size Tokens in the mobile code, which can be used as an initial reference for the prototype but are not visual facts. This time only two mobile pages and related overlays are created in Figma without modifying any implementation.

## Goals / Non-Goals

**Goals:**

- Clearly express the product path between login, registration, email verification, password retrieval, WeChat QR code and Google account selection.
- Verify information level, form density and third-party login understandability with two mobile main pages and their overlay status.
- Create the minimum Token and Components that are enough to assemble this round of pages, and output clickable prototypes and visual evidence.

**Non-Goals:**

- The PC management terminal is not designed in this change; its modern AI product backend style does not reuse the mobile terminal page structure.
- Does not design or implement APIs, databases, authentication services, email services, OAuth, `.env`, mobile code or server code.
- Does not implement mobile phone number, SMS verification code or account merging across login methods.
- Do not copy HelloTalk's brand, icon, illustration or page structure into the project, only extract the style features such as large white space, rounded cards, distinctive main operations and lightweight hierarchy.

## Decisions

### Decision: The login page uses username and password as the main path

The default page directly displays username and password input, main login button, registration and forgotten password portals; WeChat and Google serve as secondary login methods below the divider to avoid multiple portals competing for the same visual level.

Register using username, email and password. The username is clearly marked "for login", and the first profile page uses "display name" to avoid confusion between the two concepts. Both email verification and password retrieval use overlay or result status to return to the login page, without additionally increasing the number of main pages.

### Decision: Use understandable overlay for third-party logins

The WeChat portal opens the QR code modal, which includes "Please use another device to scan the code", waiting, success, expired and refresh status; the Google portal opens the account and selects the bottom sheet, which displays the account avatar, name, email, cancellation and authorization failure status. Real QR codes and real account data do not enter the prototype, and clearly marked demonstration content is used.

The app/client id, secret, provider URL and redirect URL required for future development do not belong to this round of design delivery; Figma only retains the note that "sensitive keys must not enter the client or design files".

### Decision: The two main pages use overlays to express the authentication branches.

Figma main Frame is 390 × 844:

1. `Auth / Sign in`: Login with user name and password is the main path, registration and forgotten password are text entries; WeChat and Google are secondary provider buttons.
2. `Profile / First setup`: Include avatar, display name, gender, nationality/city, interests, CEFR and year of birth in scrollable content, with the main action at the bottom kept clear.

Registration form, email to be verified, password retrieval, WeChat QR code, Google account selection and error prompts are used as variations of the login page or modal/bottom sheet, without increasing the number of main pages. The WeChat QR code clearly prompts that another device is required, and provides other ways to refresh after expiration and return.

### Decision: Establish the minimum visual foundation first without expanding the complete design system

Reuse the existing neutral token in the code and supplement the brand color, status color, font size, spacing and rounded corners required by this prototype. Visually references the lightness of HelloTalk, but uses the project's own purple main operation, warm white background and simple geometric decoration; uses Noto Sans SC for Chinese fonts and Noto Sans for English, ensuring that Figma is usable and cross-platform replaceable.

The first round of components only includes: primary/secondary buttons, provider buttons, text input, selection fields, avatar upload, interest chip, step prompts, modal/bottom sheet and form feedback. The touch target is not smaller than 44 × 44, and the text and key operations meet the readable contrast ratio.

### Decision: Accept only with Figma evidence

- Structure: Two main Frames, necessary overlays, reusable components and variables all have stable names.
- Visual: Screen-by-screenshot checking of 390 × 844 dimensions, text cropping, spacing, contrast, alignment, and hierarchy.
- Interaction: Click on the path to demonstrate login, registration, email to be verified, password retrieval, WeChat QR code, Google selection and entering the first information page.
- Form: The first information page can scroll to display all required fields, and the main operation at the bottom is clear and does not overlap with the content.

## Risks / Trade-offs

- [Risk] WeChat QR code on mobile phone requires another device, which may cause confusion. → The prototype explicitly states the usage conditions, provides a return entry, and separately tests the task completion rate; whether to add native WeChat authorization and create a new change.
- [Risk] There are many registration and password retrieval states, and the two main pages are easily mistaken as having only two design states. → Place the overlay and status Frame in groups, and use prototype connections to show the relationship.
- [Risk] Username and display name are easily confused. → The registration page explains that the username is used to log in, and the profile page uses "display name" and explains the public scope.
- [Risk] Reference style is too close to HelloTalk. → Reuse only abstract visual principles, using your own colors, copy, composition, icons and component proportions.
- [Risk] Too many data fields cause the first screen to be crowded. → Check small screen accessibility in visual acceptance using scrollable single pages, clear groupings and progressive prompts.
