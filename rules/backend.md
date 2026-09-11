# Backend Rules

## Stack and System Shape

- 后端使用 NestJS + TypeScript + Express adapter，采用 modular monolith；没有压测或兼容性证据时不切换 Fastify，未经独立 Architecture change 不拆微服务。
- 启动配置使用 `@nestjs/config` 并通过 Zod 在 bootstrap 阶段校验；缺失或非法的必需配置必须阻止应用启动。
- PostgreSQL 是持久事实来源。Redis 只用于临时协调、presence、限流、缓存、队列或原子并发保护，不替代数据库事实。
- `openapi/openapi.yaml` 是唯一发布的 API contract。API-first 或 NestJS code-first generation 在实现首批 API 的 Architecture 阶段确定，不维护两份 contract。

## Top-level Ownership

- `src/config/`：配置注册、环境变量解析和启动校验；不得包含领域规则。
- `src/common/`：跨模块技术机制，如 decorators、guards、filters、interceptors、pipes 和基础 errors。
- `src/infrastructure/`：数据库、Redis、LiveKit、OAuth、observability 等全局适配设施。
- `src/modules/<domain>/`：按业务域组织 application 和 domain 行为，例如 auth、users、profiles、rooms、voice、moderation、audit。
- `prisma/schema.prisma`：只放 generator 和 datasource；不得继续堆放 model 或 enum。
- `prisma/models/*.prisma`：使用 Prisma multi-file schema，一份文件只定义一个 model；跨 model 共用 enum 统一放 `prisma/enums.prisma`。
- `prisma/migrations/`：保存不可随意改写的历史迁移；Prisma model 不是跨层 domain model。

`common` 和 `infrastructure` 不得成为无所有者业务代码的存放区。不能明确服务对象和依赖方向的代码留在拥有它的 module。

## Module Layers

复杂模块采用：

```text
presentation -> application -> domain
infrastructure -> domain ports
```

- `presentation/`：controller、transport DTO、参数解析和协议错误映射。
- `application/`：use case、事务边界、命令/查询编排和 port 调用。
- `domain/`：实体、值对象、policy、不变量、领域事件和 repository/service ports。
- `infrastructure/`：Prisma repository、LiveKit/OAuth/外部服务 adapter 及 module wiring。

Domain 不依赖 NestJS、Prisma、Redis、LiveKit、HTTP DTO 或环境变量。Infrastructure 可以依赖 domain port，domain 不反向依赖实现。

## Controller and Service Boundaries

- Controller 必须保持薄，只处理协议、DTO、身份上下文和 application 调用。
- Controller 禁止直接调用 Prisma、Redis、LiveKit SDK、OAuth SDK 或其他外部 provider。
- Application service 不返回 HTTP Response 或 transport-specific exception；由 presentation 映射为协议结果。
- 房间容量、加入资格、房主移交、移除重入和处罚限制等不变量必须在服务端 domain/application 层执行。
- 跨模块调用优先使用目标模块公开的 application API；禁止深层导入其 repository 或内部 service。

## DTO, Types, and Contracts

- Transport DTO 只位于拥有 endpoint 的 presentation 层，必须与唯一 OpenAPI contract 一致。
- 不建立全局 `interfaces/`。接口跟随拥有它的 port、module 或 provider。
- 前端不得直接消费 Prisma 类型；跨端 API 类型来自 generated API client。
- Domain enum/value object 与 transport enum 的转换必须显式，不依赖偶然的字符串相同。

## External Providers

- LiveKit、OAuth、STT、AI 和其他外部服务通过 adapter 边界接入；只有真实替换、测试或隔离需求存在时才抽取 port。
- LiveKit client token 必须短期、房间限定和最小权限。平台管理凭证不得发送到客户端。
- 被移除、限制或房间结束后的用户不能通过旧 token、webhook 延迟或直接 API 请求恢复资格。
- Webhook 必须校验来源，并按 provider event ID 或业务幂等键处理重复事件。

## Security and Observability

- 身份认证、角色权限和房间不变量必须在服务端验证，包括绕过 UI 的直接请求。
- Moderation 或高权限动作记录 actor、target、reason、time 和 result；日志不得包含密码、密钥、手机号、完整私人音频或不必要转写。
- 错误对客户端返回稳定 code，对内部记录可诊断上下文；不得暴露 stack、SQL 或 provider secret。

## Structure Growth Rules

- 当前按用户要求创建完整目录骨架，但不得用空 class、空 service 或占位 repository 填充目录。
- 简单模块实现时可以只保留 module、controller、service 和 dto；当出现领域不变量、多个 use case 或 provider/repository port 时再启用对应分层。
- 一个 abstraction 至少应解决当前真实边界；不得为假想微服务、假想第二数据库或未来 provider 预建代码。
- 循环依赖优先通过重新划分模块所有权或 port 解决，`forwardRef` 不是默认方案。

## Verification

- Domain 不变量优先用快速单元测试；repository/provider 用集成测试；关键 HTTP 权限和流程用端到端测试。
- 数据库迁移必须有升级验证和与风险匹配的回滚/恢复说明。
- 并发容量、幂等、权限绕过和旧 token 重入必须验证失败路径，不能只测 happy path。
