## 1. 依赖交接与数据库扩展

- [x] 1.1 核验 LiveKit change 已实现的公开授权/presence API、provider 撤销、身份历史、审计/outbox、queue 和结束路径，记录实际代码与验收证据链接；前置未交付时停止依赖任务，Cloud BLOCKED 不得改记 PASS
- [x] 1.2 为 membership 增加 ACTIVE/LEFT/REMOVED/INVITED、离开/移除字段，为 Room 增加 hostDisconnectedAt/deadline/独立 hostReconnectVersion；通过 Prisma validate 和 schema 约束测试验证复用前置模型且未重复建表
- [x] 1.3 创建后续 additive migration 并 backfill ACTIVE，保留旧 membership、joinOrder、identity 历史及 pending command；通过空库升级链和含 LiveKit 运行数据 fixture 的真实 PostgreSQL 测试验证外键/索引、数据保留与回滚隔离边界
- [x] 1.4 扩展 rooms repository 的 ACTIVE 容量/列表/详情投影、历史最大 joinOrder 和新 identity/version 分配；通过真实数据库测试验证末位重进、离开释放名额、最后一席竞争与事务回滚

## 2. 成员离开、移除与重新邀请

- [x] 2.1 实现普通成员主动 leave 与 LEFT rejoin，复用资格/规则/密码/房间/容量校验，追加旧 identity revoke；通过单元/集成测试验证重复 leave、异常断线不离开、离开后顺序前移、重进末位和新身份
- [x] 2.2 实现房主 remove/reinvite，锁内验证当前 actor、同房间目标、lifecycle/目标 generation，邀请与 join 均校验资格/容量；通过权限绕过、移除自己、跨房间、邀请不占位、被移除者自行重入和旧请求误伤新会话测试验证规则
- [x] 2.3 将管理 mutation、actor/target/reason/time/result 审计和 outbox 原子保存，复用 provider 首试/重试并区分 pending/unavailable；通过重复请求、事务回滚、拒绝动作审计与 provider failure/recovery 测试验证无重复成功事件、旧 identity 重试不撤销新会话

## 3. 主动移交与结束

- [x] 3.1 实现房主 leave 的指定接任、默认在线最小 joinOrder 接任及无候选结束；通过单元/行锁集成测试验证非法/离线接任者拒绝、原房主退出和角色更新原子性，指定无效时不擅自采用默认者
- [x] 3.2 实现当前房主 end 并复用前置公共结束事务/撤销/删除，清除旧 host reconnect 窗口；通过 host end、无候选、expiry 与并发 leave/remove 测试验证唯一房主、结束优先、重复调用幂等和所有 join/token 被拒绝

## 4. 房主重连窗口与可恢复调度

- [x] 4.1 在前置规范化 presence 事务中接入房主断线/恢复，原子保存 60 秒 deadline、hostReconnectVersion、审计与调度命令；通过冻结时钟、重复/倒序/session 切换及中途崩溃测试验证 59 秒恢复保留权限、旧事件不新建窗口或夺回房主
- [x] 4.2 扩展 join 与 realtime credential 授权，窗口内 ACTIVE 可继续/恢复，新用户、LEFT、INVITED 拒绝并返回 ROOM_HOST_RECONNECTING/retryAt；通过定向服务测试验证未占容量、ACTIVE 重复 join 幂等，以及超时未结算不能绕过检查
- [x] 4.3 在原 BullMQ queue 增加 host-timeout handler，锁内复核 expected host/identity/reconnect version/deadline 后按在线 joinOrder 移交或结束；通过真实 Redis/PostgreSQL 测试验证过期 job no-op、重复任务、deadline 竞争与 endsAt 优先
- [x] 4.4 扩展启动/周期 reconciliation 补排数据库窗口任务，将 provider 对账产生的断线/恢复交给同一规则；通过 Redis job 丢失、全部 webhook 丢失、worker 重启及窗口内成员动作测试验证恢复后执行、不提前移交且普通 stateVersion 变化不丢失有效 timer

## 5. HTTP API 与唯一 contract

- [x] 5.1 实现 leave endpoint/DTO，普通成员不接受 successorMembershipId，房主支持指定或默认接任；通过 HTTP E2E 验证 401、无效接任者、原子退出与无候选结束的响应
- [x] 5.2 实现 removals/invitations endpoint/DTO 与目标版本防重放，复用管理 application；通过 HTTP E2E 验证普通成员/旧房主 403、跨房间目标、重复请求与重新邀请后全部资格复查
- [x] 5.3 实现 host end endpoint 并补齐管理错误映射与 ENDING/pending 结果；通过 HTTP E2E 验证结束不可恢复、provider 失败不伪报完成以及重复 end 返回既有结果或稳定冲突
- [x] 5.4 扩展 memberships、members 与 realtime-credentials 的 lifecycle/窗口/角色投影；通过 HTTP E2E 验证 REMOVED 发证拒绝、LEFT/INVITED 末位重进、容量一致、窗口内恢复与最小隐私字段
- [x] 5.5 用 NestJS Swagger DTO/decorator 生成 `openapi/openapi.yaml`；通过 parser 和 `pnpm --filter @slogan/api openapi:check` 验证四个新增 endpoint、既有三处扩展、目标 generation、稳定错误与 provider pending 响应无 drift

## 6. 业务 Smoke 与最终验收

- [ ] 6.1 在隔离 LiveKit Cloud 环境执行“移除 → 旧 token 拒绝 → 重邀 → 新 identity 加入”、指定/默认接任、60 秒恢复/超时和 host end 断开业务 smoke；保存脱敏结果，无凭证时记 BLOCKED 并保留本项未完成，不以前置 adapter smoke 代替业务证据
- [x] 6.2 在 `docs/acceptance/implement-host-controls-backend.md` 按 design 矩阵关联 current host-controls、voice-session、basic-safety-reporting 与本 delta；记录依赖、迁移/回滚演练、运行时/Cloud 结果与未执行项，UI 选择器/双设备音频/设备权限/产品接受/部署不记作已完成
- [x] 6.3 全部实现完成后运行一次 `pnpm verify:api`、`pnpm format:check` 和 `pnpm deps:check`，记录准确测试数量、Node、命令和 PASS/FAIL/BLOCKED，验证未复制 LiveKit 基础或破坏原有 API；失败时先定向修复再重跑最终验证，保持未归档等待适用验收
