## Purpose

Allow logged-in users to check their temporary restrictions and appeal results on the mobile phone, and submit the reasons once within the short window allowed by the server to avoid losing the necessary self-service processing entrance when restricted.

## ADDED Requirements

### Requirement: Display personal restriction history on mobile phone

The mobile terminal MUST read the current and historical restrictions from the authenticated personal restriction interface, and display the user-visible reason, level, start and end time, status, appeal deadline and appeal status. The list MUST support server-side cursor paging, refresh, loading/empty/error state, and MUST not display whistleblowers, background processors or internal evidence.

#### Scenario: View restriction history

- **WHEN** The logged in user opens "My Restrictions and Appeals" and turns the page
- **THEN** The page displays a summary of my restrictions and subsequent pages. Do not mix other accounts or design sample data.

#### Scenario: Unlimited recording

- **WHEN** I restricted the interface to return an empty list
- **THEN** The page is clearly empty and keeps refreshing and returning to the entrance.

### Requirement: Submit a valid appeal on the mobile phone

The mobile version MUST display the submission portal only for restrictions that are currently valid, have no appeals, and have not passed the deadline. The user MUST enter a reason that is not empty and does not exceed the length of the contract; if the same content fails and retry, the original UUID request identification MUST be used, and the reason MUST be modified to generate a new identification. After a successful submission, MUST display the pending status returned by the server and refresh the list; when the server rejects, conflicts, or the window is closed, MUST displays an error and refreshes the qualifications, and MUST not declare success or commit to a processing time limit.

#### Scenario: Submit within the window

- **WHEN** The user fills in the reason within the valid window and submits successfully
- **THEN** The page displays the pending results, and this restriction no longer displays the entrance to appeal again.

#### Scenario: Window closed during submission

- **WHEN** After the user opens the form, the deadline is reached and the server refuses to submit.
- **THEN** The page prompt window has been closed and the restriction status has been refreshed, and no success feedback is generated.
