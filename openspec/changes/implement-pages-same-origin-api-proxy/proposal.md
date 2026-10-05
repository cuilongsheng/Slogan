## Why

免费试用的两个 Pages 网站与 Render API 跨站；现有 SameSite=Lax 刷新 Cookie 无法可靠用于跨站刷新。用户已授权本轮直接实现同源代理、构建配置和验证，不创建线上资源。

## What Changes

- 两个网站通过各自 `/v1`、`/v1/*` 转发到部署配置固定的 Render HTTPS origin，保留 API 和浏览器会话语义。
- 共用 advanced-mode Worker；最终构建包含 `_worker.js`、`_routes.json`，静态页面继续走 Pages Assets。
- 上游配置错误、网络错误和不安全重定向返回脱敏 JSON；禁止缓存、自动重放和访客控制上游。
- 更新免费试用运行说明为 Upstash Redis，保留冷启动、任务恢复及公网验收边界。

## Capabilities

### New Capabilities

- `browser-api-delivery`: 两个网页入口的同源 API 交付与失败安全。

### Modified Capabilities

无。业务认证、RBAC、API DTO 和权限规则保持现有契约。

## Impact

Level 2；影响架构设计、构建实施、自动化及本地浏览器验证、部署运行说明。无视觉变更，不访问 Figma。`openapi/openapi.yaml` 仍为唯一契约，没有 API schema 变更或数据库迁移。

确认范围为本地实现及验证。非目标：资源创建、平台部署、远程迁移、账号初始化、付费升级、任务调度适配、真实 OAuth/LiveKit 验收。五账号实现位于独立工作树，本轮不修改或复制。实际平台 origin、可信代理链和免费资源负载是发布前待核对项，不能虚构为已确认。
