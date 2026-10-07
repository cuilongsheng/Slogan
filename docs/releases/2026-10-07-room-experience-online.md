# 房间体验线上发布记录

2026-10-07。用户已授权四个数据库迁移和现有环境发布；真机测试由用户自行执行。

## 已完成

- 线上数据库完成私有本地备份，236,281 bytes；SHA-256 `e927bb96793bd15928572e2612b81cef5786024de3f6870c6800db75bb6cf1f1`，`pg_restore --list` 可读。备份不进入 Git。
- Neon `slogan-preview` / `main` / `neondb` 四个增量迁移完成，共 25 个完成迁移、0 个失败；原有 5 个用户和 4 个房间保留，等级字段与消息外键正确。见 [迁移证据](../acceptance/simplify-room-and-mobile-experience/production-migrations.json)。
- 发布提交 `2f03998e110dd55b3987bd6ffdb33762f3aef8b0` 的 Vercel 和两个 Cloudflare Pages 预览构建成功。预览成功不代表生产发布。
- 当前生产 API 的 5 个预置账号密码登录通过，两个生产 Pages 同源 browser exchange / HttpOnly refresh cookie / logout 通过；Google 保持关闭。见 [认证证据](../acceptance/simplify-room-and-mobile-experience/production-auth-smoke.json)。
- 最后合同复核补齐公开分享的等级范围字段，并纠正房主必须明确选择接任者的合同描述；生成与一致性检查通过。

## 当前阻塞及剩余验证

GitHub main 仓库规则要求 PR。连接器未登录，Chrome 表单操作因 Mac 锁屏不可用，尚未创建 PR 或合并；生产 API / Pages 仍是旧提交。没有绕过仓库规则或更改规则。待用户解锁 Mac 后继续创建 PR、合并、跟踪生产部署，并验证文字消息、范围、快速退出与响应外队列清理。

云端消费者触发、停止客户端后的清理收敛和故障恢复没有 PASS 证据。完整视觉、真机键盘、两机音频与真实 STT/AI 保留未完成状态，OpenSpec 未归档。Android 产物见 [APK 记录](2026-10-07-room-experience-android.md)，iOS 不在范围。

发布与回滚顺序见 [队列方案](../deployment/room-experience-vercel-queues.md)。
