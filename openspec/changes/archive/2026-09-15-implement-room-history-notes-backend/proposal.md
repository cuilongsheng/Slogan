## Why

已有即时与预约房间保留实际 membership 和预约记录，但用户还不能查询自己的参与历史或留下私人复盘。为补全 V1 后端，先交付不依赖 STT/AI 的历史与手写笔记。

## What Changes

- 新增本人房间/预约历史分页查询，区分实际参与和仅预约，不将预约伪装为入房事实。
- 对本人实际参与且已结束的房间，提供一份私人文本笔记的读取、版本化保存和清空。
- 复用 Room、RoomMembership、RoomReservation；不复制历史快照、不保存音频或转写。

### Confirmed Scope

用户要求补全 V1 缺失后端；历史与简单会后笔记属于后续 V1 路线图。本 change 是该范围下的独立交付，不修改即时/预约加入或举报规则。

### Proposed Details

历史默认分页查询当前数据库保留的本人记录，不新增自动删除或人为隐藏期限；这不是永久留存承诺。笔记一人一房一份、纯文本最多 2000 字符，仅实际参与过且房间已进入 ENDING/ENDED 时可编辑；使用 expectedVersion 避免多端覆盖，空文本清空但保留版本栅栏。历史不暴露其他成员清单。

### Non-goals

不做自动关键词、STT、AI 总结、公开分享、统计活跃时长、前端、后台代查或部署。预约仅占位用户不得写实际会后笔记。

### Unresolved Decisions

历史产品展示周期尚无单独决定，本次保持已有数据可分页检索、不新增删除策略；未来若设期限须独立确认。其他规则以上述最小私人复盘方案供审阅。

## Capabilities

### New Capabilities

- `room-history-notes`: 本人参与/预约历史及私人会后笔记。

### Modified Capabilities

无。

## Impact

- Backend / API、Test / Acceptance。
- 新增 RoomNote 与相应唯一/外键/版本约束；room history 使用现有持久关系。
- NestJS code-first 生成唯一 OpenAPI，不修改前端与历史 PRD。
