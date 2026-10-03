## Context

Figma 文件 `56nIowZmvBhb0QJvOlDQdU` 的 V2 frame：登录 `118:2970`、注册 `118:3001`、验证邮箱 `118:3063`、找回密码 `118:3186`，均为 390×844。后端邮箱流程已在 `implement-email-password-auth-backend` 中本地实现，真实 SMTP 投递验收尚待配置。OpenAPI 是唯一合同。

## Decisions

1. 登录页恢复 V2 的用户名、密码、主登录按钮、注册与忘记密码入口，底部 Google 按钮继续调用现有 OAuth 流程。微信入口保持不可用说明，直到扫码 API 存在。
2. 原生用户名密码登录消费 `/v1/auth/password/exchange` 的 token pair 并存入 SecureStore。浏览器新增 `/v1/auth/web/password/exchange`，验证允许的 Origin，服务器设置与 Google 共用的 HttpOnly refresh Cookie，仅返回短期 access token。刷新和退出复用现有 Cookie 端点。密码和刷新 token 不进入浏览器存储、URL 或日志。
3. 注册返回的管理凭据仅在页面内存中用于重发；页面刷新后提示重新提交注册信息。邮箱确认和重置链接的 token 放在 URL fragment 中，页面读取后立即清理地址栏，再由用户操作触发 POST。未验证账号不能建立会话。
4. 错误文案按合同 code 分类。登录凭据错误统一显示，注册唯一性错误指向具体输入，找回请求始终展示统一受理结果。429/503 允许安全重试，不伪造成功。
5. 页面沿用 AuthPage、semantic tokens、Expo Router 与现有中英文资源。表单不持久化密码；回到登录页时清除表单敏感状态。

## Risks and rollback

- 浏览器密码入口若缺少 Origin 限制会带来跨站 Cookie 风险：复用 Google Cookie 端点的 Origin 白名单和 SameSite/Lax/Secure 策略，并测试拒绝非法来源。回滚时撤去新增入口；现有 Google Cookie 会话不变。
- 邮件链接可能经历史、日志或 referrer 泄露：只读取 fragment、立即移除，POST body 不记录明文；若后端链接模板不符合约定，前端显示手动输入 token 的安全替代入口并记录阻塞。
- 邮件服务未配置时无法证明注册/找回邮件真实送达：界面展示服务不可用，验收保留 BLOCKED；不能以本地捕获或假数据声称真实投递。
- 当前数据库无需迁移。发布顺序为后端 Cookie 入口及 OpenAPI、生成客户端、前端；回滚前端不影响原生密码接口或现有 Google 用户。
