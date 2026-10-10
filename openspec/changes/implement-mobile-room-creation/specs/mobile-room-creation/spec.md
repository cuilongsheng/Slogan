## ADDED Requirements

### Requirement: Users can create instant and reserved rooms

The mobile terminal MUST enter the creation page from the room discovery page, submit instant or reserved rooms according to the current OpenAPI, and display the real server results. Topic, specific CEFR level, 2–6 person capacity, and reservation start and end times MUST be verified before submission; visibility and four-digit password MUST be set independently.

#### Scenario: Create an instant public room

- **WHEN** Qualified users enter valid configuration and create instant public rooms
- **THEN** The client only issues a creation request once and uses the room ID in the response to enter the room host voice room process.

#### Scenario: Create a reservation room

- **WHEN** Qualified users enter valid future start and end times and create a reservation room
- **THEN** The client submits the ISO time that can be verified by the server, and opens the new room details after success.

#### Scenario: Server refused

- **WHEN** The server refused to create due to qualifications, restrictions, time or field constraints.
- **THEN** The page retains the original input and displays an error, does not create a successful room or automatically resubmits

#### Scenario: Room host cancel room reservation

- **WHEN** Room host Confirm cancellation before reservation starts
- **THEN** The client calls the reservation cancellation interface and displays the cancellation status returned by the server; retains room details and errors in case of failure

#### Scenario: Open the room link shared after creation

- **WHEN** The user opens the room sharing code link
- **THEN** The client first parses the sharing code and then opens the real details according to the room type; the invalid link displays an error
