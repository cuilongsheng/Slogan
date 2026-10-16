# API 性能追踪修复发布

日期：2026-10-15（Asia/Shanghai）。用户已授权发布 Preview / Production 并继续 API 性能监控。部署源为 develop 提交 7e0eda53be4a738363e34dc81a0c8747909eb6ed，使用干净 Git archive，没有上传工作区其他未提交功能，没有 push 或 merge。

## 部署

- Preview：dpl_FKsceaikaWSXgSgF6te3dKmweffi，READY；https://slogan-rlunu6bzu-cuilongshengs-projects.vercel.app
- Production：dpl_MjMguLmRwodm9PTRGE4ap2rk6XgW，READY；https://slogan-j596ya4jv-cuilongshengs-projects.vercel.app
- 正式 alias：https://slogan-api-pi.vercel.app，部署结果确认已切换。
- 两个环境沿用 SENTRY_DSN / SENTRY_TRACES_SAMPLE_RATE=0.1，没有启用新监控产品或修改凭据。

## Sentry 云端验证

Preview 的单独请求窗口为 2026-10-14 18:04:43–18:05:40 UTC；Production 的第一次窗口为 18:07:30–18:08:31 UTC。两个 trace 的 precise.start_ts 分别落在对应窗口，核查方式同时结合唯一部署 URL、刚发布的路由修复和请求时间；没有把 NODE_ENV=production 当成区分 Preview 的依据。

- Preview trace：55baf9c78a944bd78c4fa2833df98136，GET /v1/auth/capabilities，200，client_sample_rate=0.1，79.257011 ms。
- Production trace：bdfc74193b6b4bbd9981c914eb22fee2，同一路由、200、0.1，4.414082 ms。
- 数字为单个样本，不能作为压测性能或真实业务成功率。
- 两个环境正常能力接口 200、未登录个人接口 401 / ACCESS_TOKEN_INVALID。

[去敏证据](../acceptance/add-api-sentry-tracing/cloud-tracing.json)、[Preview 截图](../acceptance/add-api-sentry-tracing/preview-route-trace.jpg)、[Production 截图](../acceptance/add-api-sentry-tracing/production-route-trace.jpg)。真实错误事件送达、source map 上传、通知送达、手机端语音质量统计与跨端追踪未计入本次完成范围。release tag 的云端可用性未验证。
