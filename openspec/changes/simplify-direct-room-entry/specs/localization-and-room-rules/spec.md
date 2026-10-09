## REMOVED Requirements

### Requirement: 入房前安全规则确认
**Reason**: 用户明确要求取消入房中间步骤，普通房间点击即可加入，不再强制进入独立规则确认页面。

**Migration**: 采用 direct-room-entry 的直接入房操作。兼容现有 rulesAccepted 字段以表示入房意图，不伪称逐字阅读；用户只浏览而未点击加入时不建立 membership。现有房间内规则入口和中英文内容保留。
