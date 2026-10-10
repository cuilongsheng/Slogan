## Purpose

Define server-side facts, unified caliber, anonymous aggregation and least privilege query of V1 operational indicators, so that the platform can judge the real communication closed loop without treating logs, client statements or sensitive business details as the truth for analysis.

## ADDED Requirements

### Requirement: Indicators only use persistent server facts and versioned calibers

The system MUST calculate indicators from submitted accounts, materials, rooms, member connections, reservations, sharing attributions, AI usage, keyword saving, and secure processing facts, and return the caliber version, time window, UTC boundary, generation time, and data cutoff time for each indicator. The system MUST not generate business indicators from application logs, presence instantaneous values, client self-report duration, or raw voice content.

#### Scenario: Query the closed time window

- **WHEN** A privileged caller queries a closed day or week window
- **THEN** The system returns the determined indicator value, denominator, caliber version and data cut-off time. Repeated calculations of the same facts will yield the same results.

#### Scenario: Number of people currently online

- **WHEN** The caller queries the current number of people online
- **THEN** The system clearly marks this value as a real-time snapshot and sampling time, and does not mix it into the replayable historical cumulative indicator.

#### Scenario: Missing required server facts

- **WHEN** An indicator is missing facts required for calculation or the data window has not been completed.
- **THEN** The system returns `UNAVAILABLE` or `PARTIAL` and stability reasons, and does not treat zero as missing data.

### Requirement: V1 indicators cover activation, communication, retention, distribution and security closed loop

The system MUST provide V1 indicators such as data completion, first creation or joining of a room, first successful voice connection, at least five minutes of effective communication, average effective room duration, continued communication after AI assistance, saving expressions after the meeting, creating or joining again within seven days, sharing link opening to joining, actual entry after reservation, report processing time, repeated removal or reporting of users, room host processing completion rate, and misjudgment/abuse reporting results. Each ratio MUST return clear numerators and denominators, and do not count canceled, test, incomplete, or duplicate events into inapplicable calibers.

#### Scenario: Computing Effective Communication

- **WHEN** A member has a confirmed connection period in the started room for at least five minutes
- **THEN** The system counts this user as valid communication according to the caliber, and the overlapping interval of reconnection will not be accumulated repeatedly.

#### Scenario: Calculate sharing conversion

- **WHEN** An anonymous share link opens the fact that is subsequently linked to a successful join under the same share attribution
- **THEN** The system counts one conversion and does not save external channel accounts or any third-party tracking data.

#### Scenario: Calculate security processing time

- **WHEN** A security case progresses from establishment to final state
- **THEN** The system uses server time to calculate the processing time and excludes unfinished cases from the denominator of the completion time.

### Requirement: Aggregation grouping respects minimum sample and privacy boundaries

The system MUST only allow grouping using explicitly whitelisted time, room type, CEFR, user-initiated region and result category. Any grouping for operations analysts MUST be suppressed when unique user or room samples are less than the configured threshold; the threshold MUST not be lower than ten. Responses may not contain user IDs, room members, free text, exact birthdays, a small sample of cities, report text, case evidence, private notes, or vocabulary content.

#### Scenario: Small sample grouping

- **WHEN** The region and CEFR grouping queried by the operations analyst are below the minimum sample threshold
- **THEN** The system returns a suppression flag without returning a count or proportion of individuals that can be inferred

#### Scenario: Non-whitelist dimension

- **WHEN** The caller submitted user ID, room ID, city or free text as an aggregate dimension
- **THEN** The system returns a stable verification error and does not execute the query

### Requirement: Indicator query is isolated and audited by administrative role

The system MUST allow `OPERATIONS_ANALYST` and `PLATFORM_ADMIN` to read anonymous aggregates and trends; only `PLATFORM_ADMIN` can read restricted room operation details and internal active user rankings. Active ranking MUST only use non-content behavioral facts in public terms, which may not be made public on the user end, nor used as an automatic basis for penalties, recommendation qualifications, or rewards. Each restricted detail read MUST write a minimum audit before returning data.

#### Scenario: Operations analyst reads trends

- **WHEN** The indicator trend within the valid time range of the current operation analyst request
- **THEN** The system returns anonymous aggregations that reach the minimum sample threshold and does not return detailed identifiers.

#### Scenario: Operations Analyst bypasses detail restrictions

- **WHEN** Only users with the role of operations analyst can directly request room operation details or active user sorting
- **THEN** The system rejects the request and does not return any clue whether the target exists.

#### Scenario: Administrator can read restricted details

- **WHEN** Platform administrator reads room operation details or active sorting with effective filtering and stable cursor
- **THEN** The system returns the minimum projection and atomically records the view scope, role, result and request ID

### Requirement: The indicator pipeline is replayable and the freshness is public

The system MUST generate indicator snapshots with idempotent windows and unique caliber versions to support safe recalculation of windows that have not been frozen or explicitly marked for repair. The query MUST return the freshness of the latest successful snapshot; when the configured delay is exceeded, the MUST mark expires and generates an exception fact, and stale data MUST not be returned silently.

#### Scenario: The same window is generated repeatedly

- **WHEN** runner is executed repeatedly for the same window and caliber version
- **THEN** The system retains at most one effective snapshot and the query results are not accumulated repeatedly.

#### Scenario: Indicator snapshot expired

- **WHEN** The latest due window was not successfully generated within the configured time
- **THEN** Query explicitly returns expired status and generates or updates the same metric pipeline exception
