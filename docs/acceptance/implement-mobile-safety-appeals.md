# 手机端我的限制与申诉验收记录（2026-09-28）

- 个人入口可从房间列表底部“我的”进入 `/me`，再进入 `/me/restrictions`。未登录访问经 Gate 返回登录页。限制列表和申诉只使用现有本人 API，显示最小用户可见字段；30 分钟窗口、一次申诉和结果以服务端为准。
- 同一理由失败重试保留 `clientRequestId`，修改理由生成新标识；申诉成功或不确定失败后刷新列表。列表支持下拉刷新、空态及游标分页，下一页失败保留已加载内容。
- 用户已批准缺少独立稿的页面沿用 V2 视觉语言。390×844 Web 运行时证据：[空态](assets/mobile-safety-empty-390-visual-fixture.png)、[可申诉限制](assets/mobile-safety-active-390-visual-fixture.png)。这些是确定性认证/API 夹具，不是独立 Figma 帧的 1:1 证明。
- API 客户端与资格边界测试、同理由重试、窗口关闭和空态 UI 测试通过；移动端全套 Jest 29 组/86 测试、lint、typecheck、iOS JS export，以及 Playwright 1/1 通过。
- 尚无真实受限账号完成浏览器申诉，也未在 iOS/Android 原生开发构建验证；不能把夹具提交当成真实用户处罚/申诉验收。
