# AI Expression Assistance Specification

## Purpose

Defines private expression assistance in a live English voice room that is actively triggered by the user, so that text or short voice input can generate short expressions suitable for the current topic and English level, while maintaining room qualifications, quotas, privacy, and failure downgrade boundaries.

## Requirements

### Requirement: Expression assistance only serves current qualified room members

The system MUST only accept expression assistance requests from valid members in the current `OPEN` room, and re-verify account availability, data completion, adulthood and current security restrictions on the server. Room theme, target English, and user CEFR MUST be determined by server-side facts, the client MUST not override these contexts.

#### Scenario: Current member requests assistance

- **WHEN** A qualified user actively initiates a request for expression assistance in his current open room
- **THEN** The system uses the room theme and the user's current CEFR to process the request

#### Scenario: Direct call from non-member or invalid member

- **WHEN** Non-member, left, removed, account unavailable or currently restricted user bypasses the client and requests assistance directly
- **THEN** The system rejects the request and does not call the AI or STT provider

### Requirement: Text input generates directly spoken English expressions

The system MUST accept native text within 1–1000 Unicode code points after removing leading and trailing whitespace, and return a short and natural main English expression, zero to two optional expressions, a tone flag for each expression, and a stable prompt flag for possible AI errors. The system MUST not accept the client-supplied room theme, CEFR, system prompt word, or target user identity.

#### Scenario: Valid text request

- **WHEN** The current member submitted valid native language text
- **THEN** The system returns private English expression results that combine the server room theme with CEFR

#### Scenario: Out of bounds or empty text

- **WHEN** The user submitted a text request that was blank, exceeded the maximum length, or contained an unallowed protocol field.
- **THEN** The system returns a stable parameter error before calling provider

### Requirement: Short voice input multiplexing the same expression result contract

The system MUST allow current members to upload single segments of supported native language audio no longer than 30 seconds and no larger than 5 MiB, and use this temporary transcription for expression generation subject to `temporary-speech-processing` consent requirements. Response MUST return only expression results, not full transcription; audio that is unsupported, corrupted, timed out, or out of bounds MUST fail and MUST not enter expression generation.

#### Scenario: Valid short voice request

- **WHEN** The user actively uploads qualified short voice messages with valid consent and the STT is successful.
- **THEN** The system uses this temporary transcription to generate a private English expression with the same structure as the text entry

#### Scenario: Short speech recognition failed

- **WHEN** The audio is invalid, exceeds the limit, or the STT cannot be reliably recognized
- **THEN** The system does not call expression generation and returns a stable failure result that can be used for text input instead.

### Requirement: Expression results remain private and do not control room media

The system MUST only return expression results to the requesting user, not broadcast to the room host or other members, not automatically play, not publish audio, not speak on behalf of the user, and not use the results as live subtitles, public room content, private notes, or wordbook facts. The request context MUST not contain other members' profiles or voice content.

#### Scenario: Successfully generated expression

- **WHEN** provider returns valid expression result
- **THEN** Only the requesting user receives text results, room members and real-time media status do not change

#### Scenario: Other members try to read the results

- **WHEN** Other members use the result identifier or modify the request parameters to try to read the result.
- **THEN** The system refuses to read without revealing whether the result exists or the input content

### Requirement: Express requests can be safely retried and handle indeterminate external results

The system MUST require text and short speech requests to carry a caller-generated UUID request identifier and bind the identifier to the user, room, input mode, and normalized input digest. Retry the completed result with the same identification and content within the private retention period MUST return the original result without repeatedly deducting the user's credit; changing the content, room or input mode reuse identification MUST conflicts. During concurrent processing or when the external result is uncertain, the system MUST return a clear status and MUST not fabricate success or promise the provider side to execute exactly once.

#### Scenario: Retry after successful response is lost

- **WHEN** The user retries a successful request with the same identity and content that is still within the private retention period
- **THEN** The system returns the original result and does not regenerate or deduct the user's quota again.

#### Scenario: Reuse ID change request

- **WHEN** User changes input, room or input mode using existing identifier
- **THEN** The system returns a stable conflict and keeps the original request fact

#### Scenario: Unsure call is still being processed

- **WHEN** There is an unexpired processing lease or provider result for the same request is uncertain
- **THEN** The system returns to the status of processing or temporarily unavailable to retry, and the second generation will not be started concurrently.

### Requirement: Frequency, user quota and platform budget are executed before provider call

The system MUST enforce cross-instance frequency limits, user daily quotas, and platform-level provider budget protections for expression requests. Determine that authentication, qualification, parameter, consent, or credit checks that failed before the provider call MUST not consume provider usage; when the boundary is reached, stable limit results and available retry times MUST be returned, and MUST not affect the user's continued live voice communication.

#### Scenario: User reaches daily quota

- **WHEN** The user has reached the allowed expression auxiliary usage in the current quota period
- **THEN** The system rejects the new provider call and returns a quota exhaustion result.

#### Scenario: Platform budget close call

- **WHEN** The platform budget gate is closed or the remaining balance cannot be safely confirmed
- **THEN** System rejects new expression generation but keeps room and live speech available

### Requirement: AI failed and must be safely downgraded

The system MUST return stable results for timeouts, network failures, provider rejections, invalid structures, and unprocessable content without revealing provider details. Text generation failure MUST provide retry semantics; short voice link failure MUST indicate text input can be used instead. Any failure MUST not end the room, remove members, modify the microphone position, or automatically switch to an unconfigured second provider.

#### Scenario: AI provider timed out

- **WHEN** Expression generation exceeds server processing time limit
- **THEN** The system terminates waiting and returns to retry failure, and the human voice continues to work.

#### Scenario: provider returned an invalid structure

- **WHEN** provider response is missing a controlled expression field or exceeds output bounds
- **THEN** The system rejects the response and does not return the original provider content to the client.

### Requirement: AI provider must meet minimum data policy

The system MUST only enable AI providers that declare processing regions, data usage, maximum retention periods, and do not use request content to train public models. The configuration retention limit for the original request text and the complete response on the provider side MUST not exceed seven days, and the non-retention mode is preferred; the system MUST prohibit enabling expression generation when necessary policy configuration, keys or security endpoints are missing.

#### Scenario: provider configuration meets the boundary

- **WHEN** AI provider is fully configured and meets region, purpose, and retention boundaries of no more than seven days
- **THEN** The system can enable expression generation and only log provider class and minimum usage facts

#### Scenario: provider data policy is unqualified

- **WHEN** The provider does not declare data usage, will use the input for public model training, or the retention period exceeds seven days
- **THEN** The system refuses to enable expression generation without exposing credential values

### Requirement: Private results are retained for a short period of time and cleared upon expiration.

The system MUST only store structured expression results short-term for safe replay after response loss, and set an explicit expiration time of no more than seven days. After expiration, the system MUST clear the expression body but retain the minimum request, usage, and failure facts without original input and output; the system MUST not provide a default AI history list.

#### Scenario: Replay within retention period

- **WHEN** Requesting the user to retry with the same request ID before the result expires
- **THEN** The system returns the original private result and the original expiration time

#### Scenario: The result has expired

- **WHEN** The user retried the original request after the body was cleaned
- **THEN** The result returned by the system has expired and the provider will not be called again. The user needs to actively initiate a new request with a new ID.
