# Room sharing and extended acceptance record (2026-09-28)

## Implementation

- Instant details, reservation details, and voice room use server `shareUrl`. Web can copy the link and natively call the system to share; if it fails, the selected URL will still be retained.
- The connected voice room only displays the extension entrance to the current room host. Room host optional 15/30/60 minutes; same confirmation retains UUID and number of minutes to retry after network failure. The new end time of the server is successfully displayed; real-time synchronization `PENDING` or `UNAVAILABLE` displays synchronization to be restored.
- The backend continues to force the room host identity, OPEN status, upper limit and expiration judgment; the frontend is not optimistic about changing the countdown.

## Verification

- The mobile terminal `typecheck`, `lint`, and the full set of tests passed; the component test covers the failed retry flag and the URL is retained when sharing fails.
- The local real Google session creates an instant room and connects voice; after the room host submits a 15-minute extension, the page countdown increases from 120 minutes to 135 minutes, showing the new server end time.
- Clicking share in the same room displays the server link, and the web feedback is "Link has been copied"; open the link in a new tab and parse to enter the correct instant room details. The test room then exits from the voice page.

## Not accepted yet

- 390×844 frame-by-frame visual comparison of native system sharing panels, dual-device LiveKit time sync, and extended/shared overlays. Figma does not have an independent high-fidelity frame for this operation state. It currently uses the existing voice room visual language and cannot claim this operation state 1:1.
