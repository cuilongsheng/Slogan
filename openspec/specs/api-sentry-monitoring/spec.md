# api-sentry-monitoring Specification

## Purpose

为 Slogan API 提供可控的线上错误监控和采样追踪，保持 HTTP 错误合同、受保护信息边界及当前平台入口兼容，确保本地验证不会被误认为云端上线。

## Requirements

### Requirement: API monitoring scope and configuration

The API SHALL send only error monitoring and sampled tracing, with connection configuration and a sampling rate between zero and one supplied through environment variables. Preview SHALL use a sampling rate of 0.1 when none is specified. Environment identification SHALL prefer NODE_ENV; a platform-provided commit SHA may identify the release.

#### Scenario: Optional connection and bounded sampling

- **WHEN** no DSN is configured, or Preview has a DSN without an explicit sampling rate
- **THEN** monitoring is not initialized in the former case and uses 0.1 sampling in the latter; invalid sampling configuration prevents startup without disclosing the configured value

#### Scenario: Restricted telemetry

- **WHEN** an error or span is sent
- **THEN** it excludes Logs, Profiling, Application Metrics, request bodies, credentials, user information, SQL and content data; protected backoffice errors exclude stacks

### Requirement: Existing runtime compatibility

The API SHALL preserve existing error responses and hosting-entry recognition, report unexpected errors once, and retain business outcomes. Monitoring SHALL NOT introduce a public test endpoint or duplicate global error handling.

#### Scenario: Existing exception responses

- **WHEN** an expected business refusal or unexpected server error occurs
- **THEN** the existing response is preserved; the refusal does not generate an error event and the unexpected error produces one sanitized event through the existing error boundary
