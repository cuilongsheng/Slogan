## Context

`/v1/rooms/{roomId}/extensions` accepts 1–60 integer minutes and UUID, and returns the new `endsAt`, remaining times and `providerStatus`. The same request ID and content can be safely retried. Both instant and reservation details are provided on the server `shareUrl`, and the shared code route `/r/{shareCode}` has been received.

## Decisions

1. Share the URL returned by the server in the usage details; write the Web to the clipboard and open the system sharing panel natively. The URL can continue to be selected on the page, and failure will be clearly prompted.
2. The extension operation is only displayed when the voice room is connected and the current role is HOST. Open the confirmation layer to generate the request UUID; change the minutes to get a new UUID; retry the same choice after network failure to keep the UUID.
3. Successfully displays the end time and `providerStatus` returned by the server. `PENDING`/`UNAVAILABLE` only indicates that the real-time synchronization has not been completed, and does not describe the submitted business extension as a failure. Subsequent retrieval of time from room details API.
4. The page hiding rule is just for experience; the backend continues to verify the current room host, room status, minutes and maximum three times limit. Conflict retain error and refresh room status.

## Risks and rollback

- Browser clipboard permission may be denied: Keep selectable URLs on the page and failure feedback, do not generate new links.
- The business is written successfully but the network response is lost: the fixed UUID allows the same command to be retried without automatically updating the request content.
- The room host identity may be transferred during the elastic layer: the server will refresh the current status after rejection, and the front end is not optimistic about the update end time.
