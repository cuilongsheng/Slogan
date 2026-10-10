## Why

PC 管理端目前只有工程启动页。已经确认的六张后台 V2 设计稿和现有后台 API 尚未形成可使用的管理工作台，安全员、管理员和审计员无法在浏览器完成日常工作。

## What Changes

- 建立浏览器后台登录、刷新恢复、退出及 `/v1/backoffice/me` 实时角色校验，按角色显示可进入的导航。
- 按 Figma V2 实现房间管理、安全案件、限制申诉、安全降级事件、后台角色和操作审计六个页面，接入唯一 OpenAPI 生成客户端。
- 列表提供适用的过滤、游标分页、加载、空态、错误和权限拒绝。安全处置及角色变更采用服务端支持的命令、二次确认和结果刷新。
- 补齐后台房间运营明细成功响应在 code-first OpenAPI 中遗漏的结构，避免前端依赖未声明字段。
- 为案件和申诉统计卡提供遵守现有后台权限范围的全量服务端计数接口。
- 记录桌面视觉、真实 API 运行时、权限及自动化验证证据；同时维护移动端剩余前端工作的代码盘点。

## Capabilities

### New Capabilities

- `admin-workspace`: 经当前后台角色授权的 PC 工作台页面与交互。

### Modified Capabilities

无。房间运营明细的已有运行时响应在本 change 的 `admin-workspace` 能力中补充合同声明。

## Impacted delivery stages

- Architecture
- Prototype / Figma
- Backend / API
- Frontend
- Test / Acceptance

## Impact

`apps/admin`、`apps/api` 运营响应 DTO 与安全统计查询、`openapi/openapi.yaml`、`packages/api-client`、后台 E2E/视觉验收。无数据库迁移。Figma 文件 `56nIowZmvBhb0QJvOlDQdU` 的 `07 后台 / V2 高保真` 六张 1440×900 页面已由用户确认。
