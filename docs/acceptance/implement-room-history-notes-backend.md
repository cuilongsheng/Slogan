# 房间历史与私人笔记后端验收记录

## 范围和基线

2026-09-14，基于 `develop` 的 `2687b1a30c90ee1b4abe5a768e28822153922b04` 未提交工作区实施。前置身份资料、即时房间、LiveKit、房主管理、安全举报和预约房间后端均保留；预约 change 的本地验收基线为七段迁移、102 个单元测试、81 个集成测试和 46 个 HTTP E2E，共 229 个测试。LiveKit Cloud 验证仍按用户决定保留未完成，本 change 不依赖外部 provider。

## 实现与证据

- `GET /v1/me/room-history` 仅从认证用户的 membership 与 reservation 生成历史；同房存在实际 membership 时优先 `PARTICIPATED`，仅预约显示 `RESERVED_ONLY`，并使用 `(occurredAt,roomId)` 确定性倒序游标。
- 历史响应只返回房间和本人关系的最小投影；不返回密码摘要、LiveKit identity、其他成员或预约人、举报内容及笔记正文。
- `GET/PUT /v1/rooms/{roomId}/note` 仅允许 ENDING/ENDED 房间的历史 membership 用户访问本人笔记。仅预约和无关系用户统一返回历史上下文不存在，LEFT/REMOVED 不失去会后资格。
- 一人一房只保留一个 RoomNote。首次版本为 1；保存使用 `expectedVersion`，相同完成请求可安全重试，不同并发编辑只能成功一个。
- 空白输入写入 nullable tombstone 并递增版本，清空后的旧请求不能恢复文本。应用按 Unicode code point 限制 2000 字符并拒绝非法控制字符，数据库同时保留长度和正版本约束。

### 定向证据

- `test/unit/room-note.policy.spec.ts`：11 个策略测试覆盖空白清空、Unicode 边界、控制字符、版本和房间状态。
- `test/integration/room-history-notes.spec.ts`：6 个真实 PostgreSQL 测试覆盖各 membership/reservation 生命周期、同房去重、稳定分页、预约到参与再到笔记清空闭环、并发编辑、幂等重试、隔离和事务回滚。
- `test/e2e/room-history-notes.e2e.spec.ts`：4 个认证 HTTP 测试覆盖三个入口、最小响应、本人隔离、资格/状态/版本/内容错误和未认证请求。
- `test/integration/room-history-notes-migration.spec.ts`：2 个隔离 schema 场景覆盖空库及含即时/预约房间、ACTIVE/LEFT/REMOVED、reservation、identity、report/event fixture 的八段升级，验证旧数据、RESTRICT 外键和数据库约束保留。
- `openapi/openapi.yaml` 已由 NestJS code-first 生成上述三个入口，未维护第二份合同。

## 迁移和回退

新增 `20260914000000_room_history_notes`，不改写前七段迁移，也不回填历史笔记。迁移只新增 RoomNote 表、唯一索引、查询索引、版本/长度约束，以及指向 Room 和 User 的 RESTRICT 外键；完整八段迁移已在本地测试数据库和两个隔离 schema 应用成功。

发布时让 migration、repository/service 和三个入口同批上线。旧实例不会访问新表；回退先移除三个入口并保留 RoomNote 表和数据，不执行破坏性 down migration，后续优先向前修复。未执行生产迁移或回退。

## 验证状态

最终 `pnpm verify:api` 一次 PASS：113 个单元测试、89 个集成测试、50 个 HTTP E2E，共 252 个；lint、typecheck、build 和 OpenAPI drift 均通过。`pnpm deps:check` 通过（194 modules / 651 dependencies），OpenSpec 严格校验通过。`pnpm format:check` 在本记录固定后通过。

## 未完成边界

前端历史列表和笔记界面、产品验收、设备验证及生产部署未完成。本 change 不包含录音、STT、AI 总结、关键词、公开分享、统计活跃时长或永久保留承诺，也不把本地数据库与 HTTP 测试描述为生产交付。
