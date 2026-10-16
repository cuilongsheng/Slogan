## 1. Design and Contract

- [x] 1.1 Record the original list, details, passwords, rules and equipment of Desktop Bridge. Check the screenshots, dimensions, components and key coordinates of the frame; check that the screenshots are consistent with the nodes.
- [x] 1.2 Compare API fields required to generate client checklist, details, member visibility, joining and permissions; indicate READY and gaps in the acceptance record, and verify changes with OpenSpec strict.

## 2. Room discovery

- [x] 2.1 Add authenticated list/detail requests, error classification and stable cursor paging to room-discovery; use service layer testing to verify empty results, refresh, next page and invalid sessions.
- [x] 2.2 Implements the real card and loading, empty, error, refresh, and paging status of the V2 room list; checks the original list frame in 390×844 Web preview, and does not display static fake rooms.
- [x] 2.3 Implement room details and availability status, re-read the server when entering; use page tests to cover password, full, end and read failure.

## 3. Pre-move-in process

- [x] 3.1 Implement temporary password and rule status isolated by roomId; use test to verify 4-digit verification, refresh/switch room cleaning and unchecked rules cannot continue.
- [x] 3.2 implements the password page and rules page, and previews it at 390×844 against the original Figma; the password does not appear in the URL, logs or persistent storage.
- [x] 3.3 Implement device permission adaptation and inspection pages, distinguish between allow, deny, unavailable and retry; use adapter testing and browser/device available evidence verification to confirm that the membership or real-time credential interface is not called.

## 4. Routing and acceptance

- [x] 4.1 Connect the default entrance for qualified users to `/rooms`, and use the qualification gate for all rooms and routes before entering the room; use the route test to confirm that users with incomplete information and age-restricted users cannot enter.
- [x] 4.2 Compare the original Figma screenshot to complete the list and visually inspect the pre-move-in page, record contract gaps and intentional differences; check the page status during Web runtime.
- [x] 4.3 Run mobile lint, typecheck, related tests, Web/iOS export, OpenSpec strict and format check after all implementations are completed; record physical device permission acceptance status and unfinished real-time room entry range.
