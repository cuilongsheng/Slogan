## Why

现有 Figma 文件尚无产品页面、Token 或组件，需要先把新增认证入口和首次资料初始化转化为可点击的移动端原型，用低成本方式验证信息层级、表单密度和第三方登录理解度。

## What Changes

- 为移动端设计用户名、邮箱和密码注册，以及用户名密码登录入口。
- 设计邮箱验证、重新发送验证邮件和邮箱找回密码的界面状态。
- 设计微信二维码登录和 Google 账户选择弹窗，包含取消、失败、等待和二维码过期等状态。
- 设计首次资料填写页，覆盖头像、显示名称、性别、国籍/城市、兴趣、CEFR 和出生年月。
- 在 `Slogan` Figma 文件建立仅供本轮原型使用的最小 Token、Components、两个主页面和必要交互变体。
- 视觉借鉴 HelloTalk 的大留白、圆润卡片、鲜明主操作和轻快层级，但不复制其品牌、图标、插画或具体页面结构。

### Confirmed scope

- 两个 390 × 844 移动端主页面：`Auth / Sign in`、`Profile / First setup`。
- 登录页相关覆盖层：注册、邮箱待验证、找回密码、微信二维码、Google 账户选择及错误状态。
- 最小设计 Token、可复用 Components、原型跳转和视觉验收截图。
- 中文默认界面，并为后续英文文案预留可伸缩布局。

### Non-goals

- 不修改移动端、PC 管理端、服务端或任何业务代码。
- 不创建或修改 OpenAPI、数据库、认证服务、邮件服务、OAuth 配置、`.env` 或部署配置。
- 不设计 PC 管理端；其现代 AI 产品后台风格在后续独立设计。
- 不实现手机号、短信验证码或跨登录方式账号合并。
- 本轮不制作完整产品设计系统，只创建两个页面实际使用的最小基础。

### Unresolved decisions

- 生产环境 provider、邮件服务和真实配置留给未来开发 change；本轮 Figma 不保存或展示真实密钥。
- 微信二维码在单台手机上的使用限制通过原型说明测试，是否追加微信 App 原生授权入口不在本轮决定。

## Capabilities

### New Capabilities

<!-- 本次不新增 capability。 -->

### Modified Capabilities

- `identity-and-profile`: 明确原型需要表达的邮箱注册、用户名密码登录、邮箱找回、微信二维码和 Google 账户选择行为。

## Impact

- Impacted delivery stages：Prototype / Figma、Test / Acceptance。
- Figma：当前连接的 `Slogan` 文件、两个移动端主页面、登录覆盖层、最小 Token 和 Components。
- 设计记录：确认后记录 Figma file/page/frame/node 和视觉验收证据。
