# 房间体验线上发布记录

2026-10-07。用户已授权四个数据库迁移和现有环境发布；真机测试由用户自行执行。

## 已完成

- 线上数据库完成私有本地备份，236,281 bytes；SHA-256 `e927bb96793bd15928572e2612b81cef5786024de3f6870c6800db75bb6cf1f1`，`pg_restore --list` 可读。备份不进入 Git。
- Neon `slogan-preview` / `main` / `neondb` 四个增量迁移完成，共 25 个完成迁移、0 个失败；原有 5 个用户和 4 个房间保留，等级字段与消息外键正确。见 [迁移证据](../acceptance/simplify-room-and-mobile-experience/production-migrations.json)。
- 发布提交 `2f03998e110dd55b3987bd6ffdb33762f3aef8b0` 的 Vercel 和两个 Cloudflare Pages 预览构建成功。预览成功不代表生产发布。
- 当前生产 API 的 5 个预置账号密码登录通过，两个生产 Pages 同源 browser exchange / HttpOnly refresh cookie / logout 通过；Google 保持关闭。见 [认证证据](../acceptance/simplify-room-and-mobile-experience/production-auth-smoke.json)。
- 最后合同复核补齐公开分享的等级范围字段，并纠正房主必须明确选择接任者的合同描述；生成与一致性检查通过。

## 2026-10-07 发布前状态

当时 GitHub main 仓库规则要求 PR。连接器未登录，Chrome 表单操作因 Mac 锁屏不可用，尚未创建 PR 或合并；生产 API / Pages 仍是旧提交。没有绕过仓库规则或更改规则。待用户解锁 Mac 后继续创建 PR、合并、跟踪生产部署，并验证文字消息、范围、快速退出与响应外队列清理。

云端消费者触发、停止客户端后的清理收敛和故障恢复没有 PASS 证据。完整视觉、真机键盘、两机音频与真实 STT/AI 保留未完成状态，OpenSpec 未归档。Android 产物见 [APK 记录](2026-10-07-room-experience-android.md)，iOS 不在范围。

发布与回滚顺序见 [队列方案](../deployment/room-experience-vercel-queues.md)。

## 2026-10-08 自动交付续办

新增同仓库 PR/codex 分支 APK 构建与 main 生产校验后的 GitHub Release 发布。Pages 提供固定下载重定向，不把超过 25 MiB 的 APK 直接放入静态产物。API 响应头、Pages release.json 和 APK 内置提交都用于核对实际版本。配置见 [自动交付方案](../deployment/android-automatic-delivery.md)，当前本地证据与云端未完成项见 [验收记录](../acceptance/automate-android-release-delivery/README.md)。

## 2026-10-08 生产发布与实际问题

[PR #9](https://github.com/cuilongsheng/Slogan/pull/9) 已合并，生产 API、admin/mobile Pages 与 GitHub Release APK 均为 `fc7bbf86cb28ee315c6e57e4d2a62a0dfc8e56d3`。Android 自动构建与发布通过，固定下载、实际文件哈希、签名、原生标志和 15 份图标核对通过；见 [云端交付证据](../acceptance/automate-android-release-delivery/cloud-android.json)。

真实两账号房间消息、发送幂等、B1–B2 创建及分享、离房权限和最后房主退出通过。普通成员/最后房主退出分别用时 249ms / 276ms，均返回业务成功与 PENDING。停止房间 HTTP 请求六分钟后，四条持久清理命令仍未执行，房间为 ENDING；消息正文已清除。见 [真实房间检查](../acceptance/simplify-room-and-mobile-experience/production-room-smoke.json)。因此快速退出的后台收敛尚未完成验收。

已确认代码恢复缺口：播种只发生在应用启动，首次发送失败后没有请求触发的重试。SDK 的 OIDC 获取依赖请求上下文或环境中的 token；启动播种并不能保证请求上下文可用。修正采用请求内平台追踪的播种、并发合并、失败重试和五分钟成功冷却，仍由私有消费者执行持久清理。具体云端错误类别须读取 Vercel 日志与重新部署验证，不能把本地通过当成根因确认。Mac 再次锁屏阻止该日志/PR操作。

Google 保持关闭。Vercel 项目变量列表未见 AI_EXPRESSION/STT 模型和凭据配置，真实按住翻译仍等待供应商配置；不擅自选择服务或新增密钥。真机键盘/两机音频由用户执行，完整原生视觉仍未通过，OpenSpec 未归档。
