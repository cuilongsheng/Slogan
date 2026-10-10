# Documentation

Use the project [README](../README.md) for the product overview, English screenshots, quick start, and delivery summary. This index separates maintained guides from dated implementation and release evidence.

## Maintained references

| Topic                        | Entry point                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current product requirements | [OpenSpec specifications](../openspec/specs/) and [active changes](../openspec/changes/)                                                                                                  |
| Engineering workflow         | [Project guide](../AGENTS.md), [project rules](../rules/project.md), and [delivery lifecycle](../workflow/delivery-lifecycle.md)                                                          |
| Local development            | [Development guide](development.md) and [pinned toolchain](architecture/toolchain.md)                                                                                                     |
| Architecture                 | [Overview](architecture/overview.md) and [directory responsibilities](architecture/project-structure.md)                                                                                  |
| Backend and contract         | [API README](../apps/api/README.md), [OpenAPI contract](../openapi/openapi.yaml), and [generated client](../packages/api-client/README.md)                                                |
| Accounts and authentication  | [Controlled pilot accounts](preview-accounts-runbook.md) and [email/password authentication](email-password-auth-runbook.md)                                                              |
| Delivery                     | [Deployment runbook](runbooks/deployment.md), [Android automation](deployment/android-automatic-delivery.md), and [managed realtime cleanup](deployment/room-experience-vercel-queues.md) |
| Google login                 | [Provider and deployment configuration](deployment/google-sign-in.md)                                                                                                                     |
| Data operations              | [Data governance runbook](operations-data-governance-runbook.md)                                                                                                                          |
| Design references            | [Figma index](design/figma-index.md) and [README image provenance](readme/README.md)                                                                                                      |

## Historical records

- [Acceptance evidence](acceptance/README.md) records the scope, commit, environment, results, and gaps of individual deliveries. Older screenshots and inventories describe their recorded version, not the current UI or a current completion claim.
- [Release records](releases/README.md) record deployment and rollback evidence. OpenSpec archive status is independent of production release status.
- [Archived changes](../openspec/changes/archive/) preserve approved requirement changes and their delivery trail.
- [PRD V1](init/PRD_V1.md) is the frozen first product baseline and remains in its original language. [Long-term directions](init/PLAN_V2.md) are historical ideas, not phase-one requirements.

Engineering documents, comments, and project explanations use English. The root README additionally provides a [Simplified Chinese edition](../README.zh-CN.md). Product Chinese localization remains supported. A phase-one freeze does not turn pending provider, device, or product acceptance into a completed result; consult the applicable active change and its evidence.
