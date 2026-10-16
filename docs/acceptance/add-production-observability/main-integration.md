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

## 干净检出与云端预检补充

CI 发现共享包只 typecheck 不产生 dist，已在两条检查流水线先构建 shared；Vercel 自动 Preview 单独执行 API build，API build 也显式构建 shared。在没有 shared/dist 的条件下 API 构建通过。新增 seed regression 的 ESM mock 类型及 response fixture 已随完整 typecheck 修正，API unit 为 54 suites / 287 tests。

真实 Preview `49dea1b` 发现健康路径缺少 Public 标记，被全局 AccessTokenGuard 返回 401。健康 HTTP 测试改为完整 AppModule，修复前 2 tests 正确失败；修复只标记最小 HealthController 的 live/ready 为匿名，并验证 /v1/me 仍返回 401。未调整后台详细健康信息的权限。

2026-10-16 已按用户授权使用 Better Stack Free：五个外部检查（API ready、Admin/Mobile 网站及各自同源 ready），3 分钟检查/故障确认/恢复；独立 monitor 60 秒 + 180 秒宽限、realtime recovery 300 秒 + 720 秒宽限。正式 ready/heartbeats 在新部署前暂停，网站外部检查 Up。两条 heartbeat URL 作为 Vercel Production sensitive 变量保存，值不进入证据。没有添加支付方式或启用付费功能。

独立验收心跳 510022 发生真实 missing-heartbeat incident 1032744726，2026-10-16 02:55 UTC 自动恢复，持续 37 秒；当前账号 Gmail 已确认故障、恢复两封邮件，验收心跳已暂停。实际 Sentry sink adapter 在 test 环境发送固定技术 component OBSERVABILITY_ACCEPTANCE 的 OPEN/RESOLVED 事件，两次 ingest 均 2xx；云端 issue 153988134（OPERATIONAL_ALERT）及 153988137（OPERATIONAL_RECOVERY）已出现，邮件 SLOGAN-API-8 同时包含两者。这证明外部通知与 sink 送达，尚不替代生产 DB/outbox/调度链验收。

截图只保存本机 `/Users/cls/.codex/observability-evidence/2026-10-16/`，不提交含邮箱或邮件登录链接的材料。生产迁移、guarded deployment 与无人请求时的持续扫描结果仍待记录。
