## 1. 数据模型与领域规则

- [x] 1.1 核验预约 change 的 Room/RoomMembership/RoomReservation、举报历史资格和七段迁移基线，在验收记录写明实际 revision、测试数量及未完成边界。
- [x] 1.2 新增一人一房唯一的 RoomNote model 与 additive migration，使用空库和含即时/预约、各 membership lifecycle、reservation、identity、report/event fixture 的升级测试验证历史数据和 RESTRICT 关系保留。
- [x] 1.3 实现笔记文本规范化、2000 Unicode 字符上限、控制字符拒绝及稳定错误，以最小单元测试覆盖空白清空、边界字符和非法输入。

## 2. 本人历史查询

- [x] 2.1 实现以当前 userId 限定的 membership/reservation 并集查询，同房优先 PARTICIPATED 并返回本人最小投影；用真实 PostgreSQL 测试覆盖 BOOKED/CANCELLED/CONSUMED/EXPIRED 与 ACTIVE/LEFT/REMOVED/INVITED 的去重和隔离。
- [x] 2.2 实现 `(occurredAt,roomId)` 确定性倒序游标和有限分页，以同时间记录、跨页插入、非法游标和页尾测试验证无重复及稳定边界。
- [x] 2.3 提供 `GET /v1/me/room-history`，以认证 HTTP E2E 验证仅返回本人关系、笔记存在标志和允许字段，不泄露密码、provider identity、其他成员/预约人、举报或笔记正文。

## 3. 私人会后笔记

- [x] 3.1 实现笔记读取资格：仅历史 membership 且 Room 为 ENDING/ENDED；以集成测试验证 LEFT/REMOVED 仍可读取、仅预约/陌生用户统一隐藏、SCHEDULED/OPEN 被拒绝。
- [x] 3.2 实现 expectedVersion 条件保存和相同内容安全重试，以真实 PostgreSQL 并发测试验证同版本最多一个不同编辑成功、事务失败回滚且其他用户笔记不受影响。
- [x] 3.3 实现 nullable tombstone 清空且递增版本，以清空后迟到保存、重复清空和从未保存 version=0 测试验证旧内容不能复活。
- [x] 3.4 提供 `GET/PUT /v1/rooms/{roomId}/note` 并生成唯一 OpenAPI contract，以 HTTP E2E 验证本人授权、状态、版本冲突、内容边界和响应字段。

## 4. 回归与验收

- [x] 4.1 使用真实 PostgreSQL 完成“仅预约历史 → 实际参与去重 → 房间结束 → 保存/读取/清空笔记”闭环，回归即时房间、预约、举报资格及旧 API，并保存脱敏证据。
- [x] 4.2 全部实现完成后只运行一次 `pnpm verify:api`、`pnpm format:check` 和 `pnpm deps:check`；失败先跑最小失败范围修复，再重跑一次完整检查并记录准确测试数量。
- [x] 4.3 对照全部 delta 场景完成验收、迁移和回退记录，并执行 OpenSpec 严格校验；前端、产品验收和部署保持未完成，不把本 change 记为 AI/STT 或生产交付。
