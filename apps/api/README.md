# Slogan 后端技术说明

面向第一次系统学习后端的开发者，说明本项目用了什么、为什么用、代码在哪里，以及哪些能力仍需要真实环境验证。

本文基于 2026-09-17 的代码整理。版本以 [后端 package.json](./package.json)、[根 package.json](../../package.json)、[锁文件](../../pnpm-lock.yaml) 为准；实现状态以代码和对应验收记录为准。这里解释已有实现，不新增产品需求，也不代表生产部署已经完成。

## 1. 技术栈总览

核心组合：**TypeScript + NestJS + PostgreSQL + Prisma + Redis/BullMQ + LiveKit**。

| 类别 | 采用技术 / 仓库版本 | 职责 |
| --- | --- | --- |
| 运行环境 | Node.js 24.21.0 | 在服务器运行 JavaScript |
| 开发语言 | TypeScript 6.0.3 | 类型检查、业务代码、接口定义 |
| 后端框架 | NestJS 12.0.1 | 模块、路由、依赖注入、鉴权和生命周期 |
| HTTP 框架 | Express 5.2.1 | 接收 HTTP 请求、执行中间件、返回响应 |
| 关系型数据库 | PostgreSQL；测试镜像 17.6 | 用户、房间、会话、举报等持久数据 |
| ORM / 迁移 | Prisma 7.10.0 | 类型化数据库访问、数据库结构迁移 |
| 数据库驱动 | pg 8.23.0、@prisma/adapter-pg 7.10.0 | 连接 Prisma 与 PostgreSQL |
| 临时数据服务 | Redis；测试镜像 7.4 | 在线状态、临时协调、队列等 |
| Redis 客户端 | ioredis 6.0.0 | 连接并操作 Redis |
| 任务队列 | BullMQ 6.3.4 | 延迟任务、并发执行、失败重试 |
| 实时语音 | livekit-server-sdk 2.19.0、@livekit/rtc-node 1.0.0 | 房间控制、凭证、webhook、音频订阅 |
| 登录凭证 | @nestjs/jwt + 自建会话管理 | Access Token、刷新令牌、会话撤销 |
| 第三方登录 | Google / 微信 OAuth 适配器 | 对接外部身份服务 |
| 请求校验 | class-validator、class-transformer | 请求字段校验和转换 |
| 配置校验 | @nestjs/config、Zod | 读取环境配置，启动时校验 |
| 接口契约 | @nestjs/swagger、OpenAPI、yaml | 从接口代码生成唯一契约 |
| AI / STT | OpenAI-compatible HTTP 适配器 | 英语表达生成、语音转文字 |
| 日志 | Pino、pino-http | 结构化日志、请求 ID、脱敏 |
| HTTP 安全 | Helmet、CORS、rate-limiter-flexible | 安全响应头、跨域策略、请求限流 |
| 后端测试 | Jest、ts-jest、Supertest、@nestjs/testing | 规则、数据库、HTTP 流程验证 |
| 契约验证 | @apidevtools/swagger-parser | 校验 OpenAPI 文档结构 |
| 本地测试设施 | Docker Compose | 隔离的 PostgreSQL、Redis |
| 工程工具 | pnpm workspace、ESLint、Prettier、dependency-cruiser | 多包管理、规范、模块依赖检查 |

`reflect-metadata`、`rxjs` 是 NestJS 运行时相关依赖，不需要把每个底层依赖都当成一套独立架构来学习。Playwright 属于仓库的浏览器/跨应用验证工具；后端 HTTP 测试主要使用 Supertest。

## 2. Node.js、Express、NestJS 的关系

- **Node.js** 是运行环境：让 JavaScript 在服务器上运行。
- **Express** 是 HTTP 框架：处理路由、中间件、请求和响应。
- **NestJS** 在此基础上组织应用：模块、服务、依赖注入、守卫、参数校验、异常处理等。

本项目通过 `@nestjs/platform-express` 使用 Express。典型 Controller 如下（简化示意）：

```ts
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  async create(...) {
    return this.rooms.create(...);
  }
}
```

`@Controller` 定义路由范围，`@Post` 定义 HTTP 方法。构造函数中的 `RoomsService` 由 NestJS 创建和提供，这叫**依赖注入**。Module 负责登记、组合这些服务及其依赖。

对前端开发者而言，新知识主要是权限、数据一致性、并发和故障恢复，而不是 TypeScript 语法。

## 3. 架构和业务模块

核心 API 采用**模块化单体**：一个 NestJS 应用，内部按业务划分模块。另有独立启动的房间语音 worker；这不意味着整个系统采用微服务架构。

| 模块 | 主要职责 |
| --- | --- |
| auth / profiles | 登录、会话、个人资料 |
| rooms | 房间、加入、预约、历史、笔记、延时等 |
| voice | 实时身份、语音凭证、LiveKit 控制 |
| social | 好友和空闲状态等 |
| moderation / safety | 举报、安全案件、限制、申诉 |
| backoffice / audit | 后台权限、操作审计 |
| assistance | AI 表达辅助、短语音处理 |
| speech-safety | 房间敏感语音检测 |
| room-speech-processing | 房间语音处理共享协调 |
| post-room-learning | 会后关键词、单词本 |

复杂模块内部有四层：

| 层 | 负责什么 | 示例 |
| --- | --- | --- |
| presentation | 接收请求、校验传输结构、整理响应 | Controller、DTO、Presenter |
| application | 编排一次完整业务操作 | 创建房间、加入房间的 Service |
| domain | 业务规则及接口定义 | 容量规则、加入资格、Repository port |
| infrastructure | 实现数据库和外部服务访问 | Prisma Repository、provider adapter |

依赖方向是 `presentation → application → domain`，基础设施实现 domain 定义的接口。Domain 不依赖 NestJS、Prisma 或服务商 SDK。

**Port** 是业务需要的能力接口；**Adapter** 是某种具体技术的实现。比如业务需要“保存房间”，Prisma Repository 实现这个能力。这样业务规则不必直接认识数据库驱动。

完整目录职责见 [项目结构](../../docs/architecture/project-structure.md)，此处不重复整棵目录树。

## 4. 一次 HTTP 请求怎么流转

以 `POST /v1/rooms/:roomId/memberships` 加入房间为阅读入口：

```text
客户端请求
  → HTTP 中间件：日志、请求 ID 等
  → Guard：身份和会话校验
  → ValidationPipe：请求字段校验、转换
  → Controller：提取身份和参数
  → Service / Policy：加入资格和业务规则
  → Repository：事务内查询、检查、写入
  → Prisma / PostgreSQL
  → Presenter：整理响应 DTO
  → 返回 HTTP 响应
```

失败时由异常处理机制转为稳定的错误响应。加入业务房间和申请 LiveKit 凭证是需要协调的不同步骤，不应理解成每次加入请求直接传输音频。

建议按顺序阅读：

1. [应用启动配置](./src/bootstrap/create-api-app.ts)
2. [身份 Guard](./src/common/guards/access-token.guard.ts)
3. [房间 Controller](./src/modules/rooms/presentation/rooms.controller.ts)
4. [房间 Service](./src/modules/rooms/application/services/rooms.service.ts)
5. [房间 Policy](./src/modules/rooms/domain/policies/room.policy.ts)
6. [房间数据库实现](./src/modules/rooms/infrastructure/prisma-room.repository.ts)

## 5. PostgreSQL 和 Prisma：持久化与并发

**PostgreSQL 是数据库，Prisma 是访问数据库的工具。** 调用关系通常是 `Service → Repository → Prisma → PostgreSQL`。

Prisma 提供类型化查询和数据库迁移。模型位于 [prisma/models](./prisma/models)，表结构变更记录位于 [prisma/migrations](./prisma/migrations)。迁移是数据库结构的演进记录，不是每次启动都删除重建数据库。

ORM 不会自动解决业务并发。假设房间只剩一个位置，两个人同时加入，都可能先读到“还有一个空位”。若分别直接写入，房间就可能超员。

当前房间 Repository 使用了：

- `$transaction`：将相关数据库操作放进事务；失败时相关写入回滚。
- `SELECT ... FOR UPDATE`：锁定相关数据行，协调并发修改。
- `pg_advisory_xact_lock`：按业务标识取得事务级协调锁。
- 请求标识及相应业务检查：处理同一操作重试的情况。

**幂等**指同一业务操作被重复提交时，不应重复产生业务效果。按钮禁用只能改善交互，服务端仍需应对重试、多个设备和直接 API 请求。

数据库事务也不能自动回滚已经发往 LiveKit 的外部请求；跨系统一致性需要命令记录、重试和对账等机制。

## 6. Redis 和 BullMQ：临时状态与后台任务

PostgreSQL 保存持久业务事实；Redis 用于临时状态和协调。例如好友关系保存在数据库，在线状态可以使用会过期的 Redis 数据，worker 归属需要临时协调。

BullMQ 是基于 Redis 的任务队列。目前 [实时任务队列](./src/infrastructure/redis/realtime-queue.service.ts) 包含房间到期、房主超时、预约窗口和实时控制命令任务。

它提供延迟执行、并发控制、失败重试和退避。退避表示失败后逐步拉长重试间隔，避免持续冲击故障服务。任务也可能重复执行，因此处理逻辑仍需幂等。

项目把关键调度依据和命令保留在 PostgreSQL，Redis 不作为唯一业务事实来源。只在 Redis 中放一个延迟任务，不能独立保证业务永远不会漏执行。

## 7. LiveKit：业务控制与语音媒体

| 部分 | 职责 |
| --- | --- |
| NestJS API | 能否加入、谁是房主、是否受限、应签发什么权限 |
| LiveKit | 实际语音连接、媒体传输、参与者连接管理 |
| 房间语音 worker | 在满足业务条件时接入房间、订阅音频、驱动语音处理 |

流程概括：客户端申请加入 → 后端检查业务资格 → 获取限定房间及权限的 LiveKit 凭证 → 客户端连接 LiveKit → LiveKit 通过 webhook 报告事件。

**Webhook** 是外部服务主动调用后端报告事件，例如成员连接变化。后端必须校验来源，并处理重复、延迟事件。实际实现见 [LiveKit adapter](./src/infrastructure/livekit/livekit.adapter.ts)。

- `livekit-server-sdk`：凭证、管理接口、webhook 等服务端能力。
- `@livekit/rtc-node`：媒体 worker 接入房间并读取音频轨道，见 [媒体源](./src/workers/room-speech/livekit-room-media-source.ts)。

普通 HTTP API 不转发所有人的实时音频。BullMQ 任务 worker 与持续处理媒体的语音 worker 也属于不同工作类型。

真实 Cloud 连接、旧凭证撤销和真机音频表现，需要外部验收证据，安装 SDK 或 fake 测试通过不能替代。

## 8. 登录、会话与授权

当前采用 **JWT Access Token + 随机 Refresh Token + 数据库 Session**。

| 概念 | 用途 |
| --- | --- |
| Access Token | 请求接口时携带的访问凭证 |
| Refresh Token | 更新过期的访问凭证 |
| Session | 数据库中的会话状态，支持撤销 |
| Guard | 请求进入业务处理前的身份检查 |

[会话服务](./src/modules/auth/application/services/session.service.ts) 中的实现包括：

- 校验 JWT 签名、有效期、签发者和受众，并查询会话是否有效。
- 用安全随机数生成 Refresh Token。
- 用 HMAC-SHA256 计算摘要，持久化摘要而不是明文刷新令牌。
- 刷新时轮换令牌，并检测旧令牌重复使用。
- 退出登录时撤销会话。

因此这不是只验 JWT 签名的完全无状态方案。Google / 微信通过独立 OAuth adapter 接入；代码存在与真实平台授权联调完成是不同状态。

**认证**回答“你是谁”，**授权**回答“你能做什么”。已登录不代表能移除成员、查看别人的数据或执行后台处罚；房主、角色和资源归属需要独立检查。

## 9. 参数校验和 API 契约

TypeScript 类型在运行时不能阻止客户端发送不合法 JSON。

| 对象 | 工具 | 示例 |
| --- | --- | --- |
| 启动配置 | Nest Config + Zod | 数据库连接、密钥、功能开关是否合法 |
| HTTP 参数 | class-validator + class-transformer + ValidationPipe | 必填、类型、范围、额外字段 |

当前全局 ValidationPipe 启用了字段白名单、额外字段拒绝及转换。请求 DTO、数据库模型和业务实体各有职责，不应因为形状类似就混用。

API 使用 **NestJS code-first**：Controller / DTO / Swagger 注解 → [生成脚本](./src/scripts/generate-openapi.ts) → [唯一 OpenAPI 契约](../../openapi/openapi.yaml)。

`openapi:check` 校验生成结果是否与仓库文件一致，避免接口代码和契约漂移。OpenAPI 负责描述接口，不是产品需求源；当前产品需求仍由 OpenSpec 管理。

整理本文时 `packages/api-client` 仍是预留生成边界，不能把完整前端客户端生成链路算作已完成。

## 10. AI 与 STT 接入

- **AI 表达辅助**：结合输入、话题、英语水平生成英语表达。
- **STT（Speech-to-Text）**：将语音转为文字，供后续业务处理。

当前通过 Node.js 原生 `fetch` 调用兼容 OpenAI 格式的 HTTP 接口，没有用 LangChain 编排，也没有自行训练模型。

[AI 适配器](./src/infrastructure/ai/openai-compatible-expression.adapter.ts) 和 [STT 适配器](./src/infrastructure/stt/openai-compatible-stt.adapter.ts) 包含配置化地址与模型、超时、响应校验、用量信息和错误转换；STT 调用还支持取消信号。

“OpenAI-compatible”描述接口格式，不代表已确定生产供应商或完成真实调用验收。当前 STT HTTP adapter 使用上传音频转写形式；房间持续音频处理及合格流式 STT 能力仍须结合实际 provider 和真实联调验证。

## 11. 安全、日志与审计

| 技术 / 机制 | 作用 | 边界 |
| --- | --- | --- |
| Helmet | 安全相关 HTTP 响应头 | 不代替业务鉴权 |
| CORS 白名单 | 浏览器跨域策略 | 不阻止绕过浏览器直接调用 API |
| rate-limiter-flexible | 高频请求限制 | 当前认证限流为进程内存，多实例不会自动共享 |
| Pino / pino-http | 结构化日志、请求 ID | 不等于生产监控与告警平台已完成 |
| 日志脱敏 | 避免凭证等敏感信息出现在日志中 | 新增日志仍需检查 |
| 业务审计 | 追溯操作者、目标、原因、结果 | 与普通调试日志职责不同 |

异常过滤器对客户端提供稳定错误结构，内部保留排查信息，不能把 SQL、堆栈或服务商密钥直接返回客户端。

## 12. 测试、开发命令和部署边界

| 验证层次 | 工具 / 环境 | 验证内容 |
| --- | --- | --- |
| 单元测试 | Jest、ts-jest | 规则、权限、状态变化 |
| 集成测试 | Jest、真实测试 PostgreSQL 等 | Repository、事务、基础设施行为 |
| HTTP E2E | Supertest、Nest 测试应用 | 路由、身份、输入输出和业务流程 |
| 外部验收 | 实际 provider / LiveKit Cloud | 真实服务行为 |
| 真机验收 | 支持的移动设备 | 麦克风、重连、前后台、音频交互 |

下面命令在仓库根目录执行。先 `nvm use`，确认 `node --version` 与 `.nvmrc` 和根 `package.json` 一致，并使用根 `packageManager` 指定的 pnpm。

```bash
nvm use
node --version
pnpm --version
pnpm install --frozen-lockfile
```

启动 API 前参考 [环境示例](./.env.example)，准备本地 `.env`、开发数据库及所启用功能需要的 Redis/外部服务配置。不要直接把示例密钥用于真实环境。更完整的工作区步骤见 [开发说明](../../docs/development.md)。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:api` | 启动 API 开发模式 |
| `pnpm --filter @slogan/api dev:room-speech-worker` | 启动房间语音 worker 开发模式 |
| `pnpm --filter @slogan/api db:migrate:deploy` | 对当前配置数据库执行待应用迁移，运行前确认目标 |
| `pnpm --filter @slogan/api db:test:up` | 启动隔离测试 PostgreSQL 和 Redis |
| `pnpm --filter @slogan/api test:unit` | 单元测试 |
| `pnpm --filter @slogan/api test:integration` | 测试库迁移和集成测试 |
| `pnpm --filter @slogan/api test:e2e` | HTTP E2E |
| `pnpm --filter @slogan/api openapi:generate` | 更新生成的契约 |
| `pnpm --filter @slogan/api openapi:check` | 检查契约漂移 |
| `pnpm verify:api` | 后端完整验证入口 |
| `pnpm --filter @slogan/api db:test:down` | 停止并清理测试环境 |

[Docker Compose 文件](./docker-compose.test.yml) 使用临时存储，仅供测试，不是生产数据库部署模板。测试不得指向真实业务数据库。

修改期间先跑相关范围，收尾再执行受影响范围的完整验证。命令通过只能证明执行到的检查，不能替代真实服务或真机验收。

生产部署、备份恢复、告警和发布状态要看 [部署 runbook](../../docs/runbooks/deployment.md)、[发布记录](../../docs/releases/README.md) 与 [验收记录](../../docs/acceptance/README.md)，不能从依赖列表推断已完成上线。

## 13. 建议学习顺序

| 顺序 | 内容 | 目标 |
| --- | --- | --- |
| 1 | Controller、Service、Module、依赖注入 | 能从一个接口找到业务实现 |
| 2 | PostgreSQL、Prisma、表关系、迁移 | 能解释数据怎么存、怎么查 |
| 3 | DTO、参数校验、异常、OpenAPI | 能独立实现一个有校验的 CRUD 接口 |
| 4 | JWT、Session、认证、授权 | 能解释登录、续期、退出和权限 |
| 5 | 事务、锁、幂等 | 能解释并发和重复请求如何处理 |
| 6 | Redis、BullMQ、重试、恢复 | 能解释后台任务失败后的行为 |
| 7 | LiveKit、webhook、媒体 worker | 能解释业务状态与媒体连接的协调 |
| 8 | 部署、监控、备份恢复 | 能维护真实运行的服务 |

第一个读透的流程建议选“加入房间”，沿第 4 节的代码入口追踪一次完整请求，再理解语音凭证。先建立完整链路，再逐步深入每种工具。

## 14. 文档职责和维护

- [OpenSpec specs](../../openspec/specs)：当前产品需求。
- [后端规则](../../rules/backend.md)：后端工程约束。
- [技术选型](../../docs/architecture/toolchain.md)：工具选型理由及历史阶段边界。
- [项目结构](../../docs/architecture/project-structure.md)：目录和模块职责。
- [OpenAPI README](../../openapi/README.md)：接口契约工作流。
- [验收记录](../../docs/acceptance/README.md)：具体变更的验证证据和阻塞项。

已有架构和开发文档中可能保留早期变更的范围说明；不要据此判断后续功能未实现。查看当前实现时，结合代码、当前 OpenSpec 和对应验收记录。新增依赖、改变架构或完成外部验收后，应同步更新本文相关说明。
