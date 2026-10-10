## Why

已确认的后台房间管理 V2 稿包含房间 ID/主题搜索、状态、可见性和时间范围控件。当前运营房间 API 只支持游标和页大小，页面无法提供覆盖全量房间的筛选。

## What Changes

- 为只读后台房间列表增加可组合的服务端搜索、状态、可见性和创建时间下界筛选，并保持稳定分页。
- 管理端按 `114:1602` 接入四个控件，筛选改变时回到第一页，展示真实结果和空态。
- 更新唯一 OpenAPI 合同、生成客户端与自动化、视觉和运行时证据。

## Capabilities

### New Capabilities

- `admin-room-filters`: 后台运营房间的组合筛选和与筛选条件一致的游标分页。

### Modified Capabilities

无。

## Impact

- `apps/api` 的后台运营房间查询与 DTO；`openapi/openapi.yaml` 和 `packages/api-client`；`apps/admin` 房间页。
- 仅已获 `OPERATIONS_DETAILS_READ` 权限的角色可查询；不增加房间处置命令或数据迁移。
