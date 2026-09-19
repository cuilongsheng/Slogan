## 1. 前置条件与集成边界

- [x] 1.1 按顺序核验 `implement-livekit-voice-session-backend` 的 RoomEvent 基础和 `implement-host-controls-backend` 的历史 membership lifecycle、管理审计与可用迁移，记录实际 revision、schema/公开入口及前置后端测试证据到本 change 验收文档；缺失时标记 BLOCKED 并停止依赖实现，不以占位模型替代或把未执行 provider 验证记作 PASS
- [x] 1.2 在 Node 24.21.0 下建立 moderation 模块和纯 domain/repository port，确定 rooms 历史上下文与 audit 同事务写入的公开集成入口，删除被真实文件替代的 `.gitkeep`；通过 typecheck 与模块边界检查验证无 domain Prisma/NestJS 依赖、深层跨模块导入或循环依赖

## 2. 举报规则与历史资格

- [x] 2.1 实现五个固定类别的显式映射、说明 trim/1–2000 Unicode 码点校验及 UUID 规范化，通过单元测试验证五类成功、非法类型/类别、空白和 emoji 长度边界
- [x] 2.2 实现只返回必要持久加入事实的 rooms 举报上下文读取和资格 policy，通过单元与 repository 测试验证 ACTIVE/LEFT/REMOVED/曾加入后 INVITED、OPEN/ENDING/ENDED 均允许，纯邀请/跨房间/陌生人和自举报拒绝，房主与普通成员规则一致且不依赖在线重叠
- [x] 2.3 实现同一举报人范围内 clientRequestId 的规范化内容比较，通过单元测试验证原内容及 trim 等价重试成功，房间/对象/类别/正文变更冲突，不同举报人的标识隔离

## 3. PostgreSQL 模型、迁移与事务

- [x] 3.1 新增独立 Report model、类别 enum、同房间 membership 外键、请求唯一键和 room/time 索引，并扩展 RoomEvent 的可空唯一 reportId 关联与举报事件约束；通过 Prisma validate 和 schema/数据库约束测试验证类别、文字上限、自举报防线、外键及一条举报最多一条成功审计
- [x] 3.2 创建 additive migration，在干净库和带前置房间/历史 membership/RoomEvent 的升级 fixture 上执行迁移，验证历史行不丢失、旧事件 reportId 为空、RESTRICT 阻止级联删除，以及旧版本 room 基础流程在加法 schema 上兼容；记录保留数据与 forward fix 的回滚步骤
- [x] 3.3 实现 moderation repository 的单事务上下文读取、Report 写入和 audit 追加，复用公开 infrastructure 事务入口而不泄露 Prisma 到 application；通过真实 PostgreSQL 成功与双边失败注入测试验证举报和审计全部提交或全部回滚，actor/target/category/time 关联准确且审计不含正文
- [x] 3.4 实现数据库唯一冲突后的事务外重读与稳定冲突映射，通过真实 PostgreSQL 并发测试验证同标识同内容只有一条举报/审计、跨房间同标识不同内容冲突、不同举报人相同标识互不干扰，以及进程/连接重建后重试返回原凭据
- [x] 3.5 验证举报与 leave/remove/end 的并发关系，通过 PostgreSQL 集成测试确认历史资格不丢失、正常举报不改变 room/membership/账号权限，并回归前置房主管理与事件审计的事务行为

## 4. HTTP、OpenAPI 与隐私

- [x] 4.1 实现 `POST /v1/rooms/{roomId}/reports` 的 DTO、薄 controller、提交用例和最小 presenter，复用全局认证且从当前身份取 reporter、服务端取首次时间；通过 HTTP E2E 验证新建/重试均为 201 且业务 body 只有 id/submittedAt
- [x] 4.2 添加 `REPORT_TARGET_INVALID`、`REPORT_CONTEXT_NOT_FOUND`、`REPORT_REQUEST_CONFLICT` 的公开错误映射，通过 HTTP E2E 验证无效/撤销会话 401、self 400、未知/跨房间上下文一致 404、重用标识冲突 409、数据库失败 500 和无副作用
- [x] 4.3 补充举报 HTTP 资格与输入测试，覆盖离开/被移除/房间结束后举报、举报当前/历史房主、五类有效请求、纯邀请拒绝、额外身份/时间字段拒绝，以及 UUID/类别/文字边界；检查被拒绝请求不产生举报或成功审计
- [x] 4.4 使用日志字段白名单和 description 路径脱敏保护正文，避免 DTO/异常序列化泄漏；捕获实际日志和成功/失败响应验证无正文、凭证、SQL 或私人资料，并验证举报不会调用 provider/通知/处罚及未暴露举报查询/修改路由
- [x] 4.5 更新 Swagger decorators/DTO 并生成唯一 `openapi/openapi.yaml`，通过 `pnpm --filter @slogan/api openapi:check` 与现有 Swagger parser 测试核对 endpoint、认证、枚举、必填字段、201 最小响应及所有错误状态无 drift

## 5. 集成验证与验收记录

- [x] 5.1 使用真实 PostgreSQL 与现有测试身份/provider fixtures 执行登录→建房/加入→离开或结束→举报→重试的 HTTP 闭环，查询持久记录证明仅一条举报和关联审计；记录运行命令及结果，不用内存 repository 或真实 OAuth/LiveKit 凭证替代此数据库证据
- [x] 5.2 全部实现任务完成后运行一次 `pnpm verify:api`、`pnpm format:check`、`pnpm deps:check`，并将 delta 每个场景对应的测试/运行证据、实际数量、Node 版本及 PASS/FAIL/BLOCKED 写入 `docs/acceptance/implement-safety-reporting-backend.md`；明确前端、真机、产品所有者验收和部署状态，保留未完成项且不自动归档
