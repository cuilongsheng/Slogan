## Purpose

Define the advance arrangement of the reservation voice room, reservation seat guarantee, start and end boundaries, and the observable behavior of members who can communicate before the room host has entered, so that the reservation will not bypass the existing account, actual room entry, real-time voucher and historical reporting rules.

## ADDED Requirements

### Requirement: Create and discover reserved rooms

The system MUST allow users who meet existing profile, age, and account qualifications to create reservation rooms, specify a theme, CEFR, capacity of 2 to 6 people including room host, valid start and end times, and an optional 4-digit password. The system MUST reject configurations that start no later than the current server time or end no later than the start, and provide a reservation room list and details, displaying time, status, actual number of members, reservation occupancy, available places, password status, and the caller's own reservation information.

#### Scenario: Create a valid reservation room

- **WHEN** Qualified users submit valid configuration and future start and end time with time zone
- **THEN** The system saves reserved rooms that have not yet been opened and displays the time and capacity after server normalization

#### Scenario: Illegal configuration or unqualified creator

- **WHEN** The user does not meet the existing creation qualifications or submitted invalid time, capacity, subject, CEFR, password
- **THEN** The system refuses to create and does not generate rooms or reservations.

#### Scenario: View reservation details

- **WHEN** Qualified users query and reserve rooms
- **THEN** The system returns the minimum public room information and my reservation status, without revealing the password, personal information or credentials of other reservation persons.

### Requirement: Reservation space and concurrent capacity

The system MUST treat valid reservations as guaranteed room quotas to ensure that the actual occupied quotas and unused reserved seats will not be double counted or the total will not exceed the room capacity. The system MUST prevent ordinary joins from seizing the valid reservation seats of other users, and perform corresponding account, rule and password verification when making reservations and actual joining; reservations MUST not bypass existing platform restrictions.

#### Scenario: Competition for the last reserved seat

- **WHEN** Multiple qualified users concurrently reserve the last available seat
- **THEN** At most one new reservation is successful, other requests receive insufficient quota results and the capacity does not exceed the limit.

#### Scenario: Members who have reservations actually join

- **WHEN** The reserved members passed the actual joining verification during the opening hours
- **THEN** The system converts its reserved seats into actual member quotas without double counting, and retains the traceability status of the original reservation

#### Scenario: Ordinary joining cannot preempt the reservation

- **WHEN** Users without reservations try to join, and all remaining physical spaces correspond to valid reservations of other users.
- **THEN** The system refuses the joining and reserves the seat of the reserved member

#### Scenario: There are unreserved places

- **WHEN** Unreserved users passed the join verification and there are vacancies that do not belong to any valid reservations
- **THEN** The system allows him to actually join without affecting the seat guarantee of other reserved members.

### Requirement: Cancel reservation and repeat request

The system MUST allow ordinary reservation users to cancel unused reservations and release their occupancy, and do not treat cancellation of reservations as exiting the established voice session. Duplicate reservation or cancellation requests MUST not repeatedly occupy or release the space, nor allow late old requests to overwrite the updated reservation status.

#### Scenario: Member cancels unused reservation

- **WHEN** Member cancels his/her unused valid reservation
- **THEN** The system saves the cancellation status and releases the seat. Other users can use the released seat according to the current rules of the room.

#### Scenario: Duplicate or late request

- **WHEN** The user repeats the same reservation operation, or the old cancellation request does not arrive until the new reservation is completed.
- **THEN** The system returns submitted results or stable version conflicts, and does not occupy or release additional newly reserved seats.

#### Scenario: Cancel reservation after actually joining

- **WHEN** A member who has used a reservation to enter the room requests to cancel the original reservation.
- **THEN** The system does not change the ACTIVE membership through this request. The member exits and continues to follow the existing leave process.

### Requirement: Reservation is not the actual qualification to join

The system MUST distinguish between reservation records and actual membership; users who only make reservations but never actually join may not obtain real-time credentials, access to the current member list, room host management rights, or historical member reporting qualifications. The actual joining failed. The original valid reservation space MUST be retained and the partial joining status should not be generated.

#### Scenario: Only reservation users can directly obtain vouchers or report

- **WHEN** Users who only have reservations but no actual joining facts directly request real-time vouchers, current member information or reports
- **THEN** The system refused based on the existing member authorization and reporting rules, and did not regard the appointment as a membership.

#### Scenario: Actual join verification failed

- **WHEN** The account, rule, password or room qualification check failed when the reserved member actually joined.
- **THEN** The system does not create a membership, does not issue a certificate, and does not incorrectly consume the still valid reservation seats.

### Requirement: Scheduled opening and room host absent for the first time

The system MUST automatically open the reserved room at the beginning of the plan, without requiring the room host to click start or arrive first. When the room host is not online yet, members MUST enter first according to the reservation and capacity rules; if the room host is not online for 5 minutes after the start, the system MUST select the second microphone to take over according to the actual joining order of the currently online ACTIVE members. The old room host cannot automatically take back the permission when it comes online later; when no one is online for 5 minutes, it will end directly. The room will be judged first and then taken over, without waiting for subsequent members. This first arrival rule MUST be separated from the 60-second disconnection window of the online room host, and no no-show counts or penalties will be incurred. Active departure, abnormal disconnection and management actions after the room host arrives will continue to follow the existing room host management rules, but the immediate end of vacancy after 5 minutes will take precedence over disconnection waiting.

#### Scenario: Try actually joining before starting

- **WHEN** User attempted to actually join or obtain live credentials before the plan started
- **THEN** The system refuses to enter or issue a permit in advance, and returns unstarted and start time information.

#### Scenario: Arrive but room host has not entered yet

- **WHEN** The scheduled start time has arrived, has not yet ended, and the room host has never actually entered
- **THEN** Qualified members can use their reservation or remaining quota to enter, and permission will not be transferred within 5 minutes after the start just because the room host is absent for the first time.

#### Scenario: Room host enter later

- **WHEN** The specified room host actually comes online within 5 minutes of starting
- **THEN** The system retains its room host identity and cancels the first arrival timeout takeover. The system retains the vacancy check after 5 minutes. Subsequent departures and disconnections are subject to the vacancy end rule.

#### Scenario: After five minutes, the second microphone takes over.

- **WHEN** It has been 5 minutes since the start, the specified room host has not actually come online yet, and there are online ACTIVE members
- **THEN** The system will atomically hand over the room host permission to the online member with the earliest actual joining order. Users who only made reservations, left, were removed or are offline will not be selected.

#### Scenario: No one can take over for five minutes

- **WHEN** It has been 5 minutes since the start, the specified room host is not online and there are no online ACTIVE members
- **THEN** The system directly ends the room and refuses subsequent joining or issuance of certificates without waiting for subsequent members to take over.

#### Scenario: The original room host is late

- **WHEN** The first arrival timeout has been completed and the takeover has been completed. The original room host entered later or its old online event was late.
- **THEN** The original room host can only enter as an ordinary member based on the existing qualifications, and the room host permissions cannot be restored through old role declaration or lateness events.

#### Scenario: Scheduling task delay

- **WHEN** The start time has arrived but the background opening task has not yet been executed. The user queries or joins the reservation room.
- **THEN** The system handles the current openable status according to the persistence time fact, and does not continue to require the room host to start manually, nor can it be opened after the end time.

### Requirement: Room cancellation and on-time completion

The system MUST allow the room host to cancel room reservations that have not yet started and make the related reservations ineffective. At the end time, the system MUST reject new reservations, actual joins, and certificate issuance, reuse the existing room ending and media cleanup mechanisms, and do not extend due to scheduling delays, room host absences, or unused reservations.

#### Scenario: Room host Cancel unstarted room

- **WHEN** Room host cancels a reserved room that has not been started and has not been cancelled.
- **THEN** The room and related reservations display the cancellation result. Repeated operations will not reopen the room. Ordinary members cannot perform room host cancellation operations.

#### Scenario: Cancel and start competition

- **WHEN** Cancellation request occurred concurrently with start time boundary
- **THEN** The system determines the result based on the server time and the fact that the same room is in the same room, and the status of canceled and new joining is not displayed at the same time.

#### Scenario: It has expired since it has not been opened or no one has entered.

- **WHEN** The reservation end time has passed when the service was restored, the room has not yet been opened and no one has actually joined.
- **THEN** The system ended it without briefly opening it or creating a new media room for cleanup

#### Scenario: Expiration and failed recovery

- **WHEN** The reserved room has expired, but the queue or media service is temporarily unavailable
- **THEN** New joins and certifications are rejected immediately, cleanup remains in a recoverable and incomplete state, and responses must not falsely report that all connections have been disconnected

### Requirement: Room vacancies will end immediately after five minutes

The system MUST calculate the 5-minute vacancy reservation period from the start time of the reservation plan; if it is less than 5 minutes, it MUST not end just because the room is vacant; if it is 5 minutes, it will end directly if no one is online. From now on, as long as the current number of people online becomes zero, including the last person voluntarily quitting, being removed, or actually disconnecting, the system MUST immediately terminate and refuse subsequent joining and certificate issuance, without waiting for members to arrive or giving additional disconnection grace. The system MUST judge based on the current actual online status, and do not replace the current online members with reservations, only completed HTTP join, offline ACTIVE, or someone has been online. The planned end time and the active end that have occurred still take precedence. This rule does not generate no-show calculations or account penalties.

#### Scenario: Temporarily vacant room within five minutes

- **WHEN** It has not yet reached 5 minutes after the start, no one is currently online and the planned end time has not been reached, and there are no other triggered end reasons.
- **THEN** The system remains open and allows qualified members to join later.

#### Scenario: No one is currently online for five minutes

- **WHEN** It has been 5 minutes since the start and there are currently no online members, regardless of whether anyone was online before.
- **THEN** The system ends the room and invalidates unused reservations, rejects subsequent join/token, and does not wait for a new successor.

#### Scenario: The last person left after five minutes

- **WHEN** It has been 5 minutes since the start, and the last online member has logged out, been removed, or has been confirmed disconnected by trusted offline observation.
- **THEN** The system starts immediately and ends without waiting for the room host to reconnect for 60 seconds; even if the member has been online before, the room will not be reserved.

#### Scenario: There is still someone online and the room host is absent

- **WHEN** 5 minutes have passed since the start, qualified members are still online but the specified room host has never come online
- **THEN** The system keeps the session and the earliest online member who joins takes over according to the first absence rule.

#### Scenario: Room host has arrived and the room is available.

- **WHEN** The room host came online on time, but the room became unavailable after the first 5 minutes or thereafter.
- **THEN** The system still starts and ends immediately, and the vacancy check is not missed because the first takeover has been cancelled.

#### Scenario: Failed to clean up at the end of vacancy or late for the event

- **WHEN** Vacancy end has been triggered, media cleanup failed temporarily or old online events are late
- **THEN** The system continues to reject join/token and restores the unfinished cleanup. It does not reopen and does not falsely report that the media cleanup has been completed.

### Requirement: Appointment extension maintains existing backend boundaries

The system MUST retain existing instant room creation and default list behavior, as well as actual membership leave, re-enter, remove/re-invite, end and report rules. Reservation scheduling recovery MUST not repeatedly open canceled or ended rooms, repeatedly assign quotas, or overwrite the room host management status.

#### Scenario: Instant room compatibility

- **WHEN** Existing client calls instant room creation and default list
- **THEN** The behavior remains compatible and does not mix in reservation rooms that have not yet been opened or require new reservation fields.

#### Scenario: A member leaves and then enters after using the reservation

- **WHEN** The member actually entered through reservation, left, and tried to join again
- **THEN** The system implements the existing re-entry qualification and last order rules, while protecting the reserved seats that are still valid for other users.

#### Scenario: Service restarted or task lost

- **WHEN** Recovery after service restart, repeated execution of time tasks or loss of temporary queue tasks
- **THEN** The system recovers time processing from persistent facts, canceled or ended rooms will not be reopened, and reservation and actual member capacity remain consistent
