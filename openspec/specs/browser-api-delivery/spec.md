# browser-api-delivery Specification

## Purpose

定义两个网页入口的同源 API 代理、固定受控上游和失败安全边界，使会话 Cookie 与网站来源保持一致。

## Requirements

### Requirement: 网页同源 API 转发

两个网页入口 SHALL 通过自身 origin 的 `/v1` 与 `/v1/*` 访问部署配置固定的 API；保留方法、路径、查询、请求体、来源、认证和状态码，不将 API 请求回退为页面 HTML。

#### Scenario: 两个网站登录和刷新

- **WHEN** 管理端或移动网页通过自身入口登录、刷新及退出
- **THEN** HttpOnly 会话 Cookie 在对应网站下设置、轮换或清除，并保留安全属性和路径
- **AND** 响应 JSON 不增加 refresh token，原始 Origin 和 Google redirectUri 的校验不被绕过

#### Scenario: 静态页面路由

- **WHEN** 访问非 API 的页面或资产
- **THEN** 使用网站静态资产处理，不消耗 API 转发路径且不要求上游配置可用

### Requirement: 固定上游与失败安全

代理 SHALL 仅访问运维配置且通过受控上游白名单校验的 HTTPS origin。白名单 MUST 保留单层 `*.onrender.com` 和已批准的 `slogan-api-pi.vercel.app`，不得放行其他 Vercel 项目、相似域名、含凭证、路径、查询、fragment 或非默认端口的配置。代理 MUST 禁止缓存 API 请求和响应、自动重放失败请求、将客户端转发/IP头当可信身份或将凭证发送到重定向外域；代理自身错误 SHALL 为脱敏 JSON。

#### Scenario: 配置或传输失败

- **WHEN** 固定上游配置缺失/无效、网络失败或首包超时
- **THEN** 返回对应 503/502/504、禁止缓存且不泄露上游细节、请求体或凭证
- **AND** 请求不被自动重试

#### Scenario: 来源与 Cookie 边界

- **WHEN** 不受信网页来源尝试认证或上游返回不安全重定向/带 Domain 的 Cookie
- **THEN** 现有来源拒绝保持有效，代理拒绝扩大 Cookie 或转发凭证的范围

### Requirement: 两站可重复构建

两个网站的发布构建 SHALL 从源码包含可执行代理和明确 API 路由，仅使用各自完整 HTTPS origin 作为公开 API base，禁止凭证进入公开配置。

#### Scenario: 最终发布产物

- **WHEN** 运行任一网站 Pages 构建
- **THEN** 输出包含页面、资产、同一代理实现与只覆盖 API 的路由配置
- **AND** 缺失或不合法公开 base 在构建前明确失败
