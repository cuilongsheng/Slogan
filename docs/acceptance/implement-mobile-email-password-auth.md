# implement-mobile-email-password-auth 验收记录

## 目标与合同

- Figma Desktop Bridge 文件 `56nIowZmvBhb0QJvOlDQdU`，V2 原稿：登录 `118:2970`、注册 `118:3001`、验证邮箱 `118:3063`、找回密码 `118:3186`，均为 390×844。
- 客户端使用 `openapi/openapi.yaml` 生成的类型；现有注册、验证、重发、密码登录、重置请求和重置接口为 READY。新增 `/v1/auth/web/password/exchange` 与 Google 浏览器登录共用 HttpOnly refresh Cookie；浏览器只收到短期 access token。邮件链接由后端固定 URL 加 `#token=...&purpose=...` 形成。
- 重置密码确认没有独立 Figma frame，沿用找回密码页的头部、输入框与按钮视觉语言。

## 本次已验证

| 项目                                 | 结果               | 证据                                                                                                                                                                                                         |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 登录 V2 390×844 位置与静态资源       | PASS               | Desktop Bridge 原稿与浏览器实测：用户名框 `(24,435,342,54)`、密码框 `(24,531,342,54)`、主登录按钮 `(24,641,342,52)`、Google `(201,749.5,165,52)`；徽标、Google、微信、状态栏使用原始资源。                   |
| 注册、验证、找回页面视觉             | PASS               | 浏览器 390×844 与三张原稿逐页对照；注册三个框 y≈223/318/413、按钮 y=554；验证邮件图标与返回图标来自 Desktop Bridge。直接打开验证页没有待验证邮箱时展示真实状态提示，不伪造邮箱地址。                         |
| Google 登录入口                      | PASS               | 登录页底部 Google 按钮保持可点击；页面测试验证选择/取消/配置错误路径。本次未重复真实 Google provider 登录。                                                                                                  |
| 浏览器密码登录安全会话               | PASS               | `email-auth.e2e.spec.ts` 本地 SMTP 测试：允许来源、拒绝非法来源、HttpOnly/SameSite Cookie、无 refresh token 响应、刷新恢复与退出；移动端 Web session 测试不写浏览器普通存储。                                |
| 原生密码会话                         | PASS（代码与测试） | `session.spec.ts` 验证密码接口 token pair 经 SecureStore 适配持久化，不保存密码。缺原生设备实测。                                                                                                            |
| 注册、验证、重发、找回与重置界面行为 | PASS（本地测试）   | `EmailScreens.spec.tsx` 覆盖输入校验、注册请求、未带 token 不确认、显式确认、统一找回受理提示、重置密码一致性；后端邮箱 e2e 10/10 通过。浏览器用无效测试 token 检查 URL fragment 清理和 503 服务不可用提示。 |
| 移动端静态/构建                      | PASS               | 17 suites / 51 tests；移动 lint、typecheck；Web 与 iOS Expo export。                                                                                                                                         |
| 后端/合同静态                        | PASS               | API lint、typecheck、build、OpenAPI check、生成客户端 check；OpenSpec strict。                                                                                                                               |

## 尚需真实环境证据

- `BLOCKED`：本机 `apps/api/.env` 未配置 `EMAIL_PASSWORD_AUTH_ENABLED`、SMTP、可信邮件链接和密钥；因此本次不能把真实注册邮件送达、重发、找回或真实账号密码登录标为通过。后端既有任务 5.4 仍待真实 SMTP/受控邮箱验收。
- `BLOCKED`：原生设备的邮件通用链接、SecureStore 生命周期与 Google 原生登录尚未做真机验证。Web 预览不能代替设备验收。
- `BLOCKED`：微信扫码仍缺二维码创建、过期与轮询合同；入口在视觉上保留，但禁用并有无障碍说明。
- 浏览器用户账号在既有 Chrome 中可恢复到 `/rooms`；本次没有用用户凭据尝试新密码登录。真实 Google provider 在本次没有重新验收。

## 运行时配置

实际邮件链接需让后端 `EMAIL_VERIFY_URL` 指向 `/email/verify`，`EMAIL_RESET_URL` 指向 `/email/reset`；两个前端页面仅通过链接 fragment 读取单次 token，并在浏览器中立即清理地址栏。生产环境必须使用受信 HTTPS 域名，且后端需要先配置 SMTP、密钥及 `EMAIL_PASSWORD_AUTH_ENABLED`。
