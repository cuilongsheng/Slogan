# implement-mobile-room-safety-alerts 验收记录

## 目标与视觉

- 日期：2026-09-30。本地实现，尚未部署或完成真机验收。
- Figma Desktop Bridge 已连接 `Slogan / 02 UI`，原始语音房 V2 节点 `115:1425`，390×844。原稿包含深紫背景、深色房间规则条和浅色底部弹层语言，但没有安全提醒状态。实现把房主提醒入口放在规则条之后，弹层沿用 V2 圆角、浅色表面与紫色强调；这是明确的新增状态，不声称逐像素来自原稿。
- 本地 390×844 Web 组件夹具截图：`test-results/mobile-room-safety-alerts-390-visual-fixture.png`。截图显示两个最小提醒和人工核实文案。临时预览路由在截图后已删除，夹具不能证明真实后端或 LiveKit 投递。

## 合同与行为

- HTTP：`GET /v1/rooms/{roomId}/safety-alerts`，使用 `@slogan/api-client` 生成类型、Bearer 认证、`limit=20` 与 `cursor`；仅当前房主可由服务端授权。
- 实时：只把 topic `slogan.room-safety-alert.v1`、`version=1`、`type=ROOM_SAFETY_ALERT` 且 roomId 匹配的 data packet 当作刷新信号。未知版本和错误房间被忽略；展示数据只取 HTTP 列表。
- 活跃房主入房、房间定期刷新和 LiveKit 重连后查询；失去房主资格、离房、结束、重连期间和查询被 403 拒绝时清空提醒。异步请求用代次隔离，旧房主结果不会回填。普通成员与未启用房间不查询、不展示。
- 页面只展示受控类别、严重度、相关成员、时间、次数与“人工核实”；没有语音/转写/命中原文，也不自动处罚。

## 本地验证

| 检查                                                                                                      | 结果                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @slogan/mobile lint`                                                                       | PASS                                                                                                               |
| `pnpm --filter @slogan/mobile typecheck`                                                                  | PASS                                                                                                               |
| `pnpm --filter @slogan/mobile exec jest --runInBand src/features/voice-room`                              | PASS：9 suites / 34 tests，含 API 路径、包过滤、实时监听、房主接任后清空、重连补齐、拒绝访问、旧请求隔离及弹层分页 |
| `pnpm --filter @slogan/mobile build`                                                                      | PASS：Expo iOS export                                                                                              |
| `pnpm --filter @slogan/mobile exec expo export --platform web --output-dir /tmp/slogan-mobile-safety-web` | PASS：Expo Web export                                                                                              |
| `openspec validate implement-mobile-room-safety-alerts --strict`                                          | PASS                                                                                                               |
| 390×844 弹层视觉夹具                                                                                      | PASS：排版可读、无溢出；原稿未定义此状态，无法称为 1:1 对照                                                        |

## 尚未完成的外部验收

- **BLOCKED — 真实 LiveKit Cloud 与合格流式 STT provider：** 尚无双人房间中实际触发受控风险、验证只送当前房主、接任与重连补齐的 smoke。后端 change 9.5 保持未完成。
- **BLOCKED — 原生设备：** 当前 iOS 开发包的 Apple Team/Keychain 签名条件尚未解决，不能完成支持设备上的 Google 登录、双人语音、定向提醒和接任测试。后端 change 9.6 保持未完成。
- 本地组件夹具、Jest 和导出均不能代替服务商及设备证明；本 change 暂不归档。
