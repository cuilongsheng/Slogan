# 监控与 main 整合验证

2026-10-16。以 origin/main `7cbbab734d26a4011538bc08647ea5bd93cea511` 为基线，整合 develop 的监控提交 `6605470fd8ea62a2f5e1f520b4dfd89b4917f2a6`。原工作区未提交的页面、字体、房间改动保留。

- 保留 main 的 realtime、maintenance、maintenance-seed、live-updates 与公共 Nest API，新增 observability：实际 Vercel 编译验证 6 个 nodejs24.x 函数及各自 maps/topic。
- 合并保留移动端启动字体、发布信息、设备检查/连接 generation、HTTP 超时和 Web credentials。监控只包装技术错误/trace，未替换页面结构。
- realtime 只有成功恢复及续接后才发 heartbeat；已有私有消费者保留队列重试，错误净化后限时排空。受保护的 maintenance seed 同时支持幂等监控 reseed，无新增公开 debug 接口。
- Production/main CI 使用已有备份、恢复验证和数据库指纹门禁，之后从实际 Vercel 产物上传 maps、删除 maps 并验证 manifest 后 prebuilt 发布。上传 token 限该步骤，不传入 compiler/deploy/runtime。
- GitHub Production 的 SENTRY_AUTH_TOKEN、SENTRY_API_DSN 已经用户单独授权并保存；已有环境限制为 main。没有读取或输出既有生产数据库/备份秘密。

## 本地验证

API：53 unit suites / 283 tests、46 integration / 236、21 HTTP / 112、8 runtime / 15 全部通过。新增 seed/managed heartbeat 及 bootstrap 定向回归 33 tests 通过。

Admin 12、Mobile 66 suites / 249、shared 11、api-client 3 tests 通过；Pages 18、源码上传门禁 7、实际 Debug ID/致命异常进程退出 3、发布/去敏诊断 6 tests 通过。Admin/Expo Web 构建通过。

整仓 lint、typecheck、format check 和 dependency-cruiser（926 modules / 3595 dependencies）通过。曾出现密码重置单测 400 和旧 fixture 清理失败，定向复测及完整重跑均通过；不把首次失败隐藏成全程无失败。

实际 Vercel fixture 编译的 6 个入口都保留：index、api/realtime、api/maintenance、api/maintenance-seed、api/live-updates、api/observability。该 fixture 无账号/部署动作；发布、数据库和外部监控的真实结果须另记。

Android 真机验收由用户执行，清单见 ../../runbooks/observability-device-acceptance.md。没有用模拟测试替代设备证据；OpenSpec 未完成任务保持未完成。
