## Context

后端活跃 change `implement-post-room-keywords-vocabulary-backend` 定义汇总访问和词汇私有管理；OpenAPI 已有 `GET /v1/rooms/{roomId}/keyword-summary`、`GET/POST /v1/me/vocabulary-items`、`PUT/DELETE /v1/me/vocabulary-items/{itemId}`。用户确认缺少独立帧时沿用 V2 设计语言。

## Goals / Non-Goals

**Goals:** 本人会后状态可见、显式单条导入、私有词汇分页筛选及并发安全管理。

**Non-Goals:** 不生成音频/转写，不自动导入，不为非参与者显示入口，不把关键词当作安全证据，不更改房间创建或语音同意规则。

## Decisions

1. 入口只在历史记录 `PARTICIPATED` 且 `ENDED` 时显示；服务端仍最终裁决。`PENDING` 提供手动刷新，`DISABLED/UNAVAILABLE` 显示明确状态；只有 `READY` 展示条目。
2. 每个汇总条目首次导入时产生客户端 UUID；请求结果不确定时同一条目的重试沿用 UUID。成功后在当前页面标记已加入，不把整个汇总自动保存。
3. 个人单词本筛选值参与游标重置。编辑、收藏、删除带 `expectedVersion`；409 保留编辑草稿并要求用户主动刷新，不用旧版本自动重试。
4. 使用既有 `RoomPage`、V2 主题 tokens 和 390×844 布局。夹具截图验证布局与交互，不声称无独立帧页面的 1:1 还原。

## Risks / Trade-offs

- [服务端汇总尚未生成或 provider 不可用] → 准确显示状态，不伪造关键词。
- [导入响应丢失] → 同一 item 重试同一请求标识。
- [编辑时其他设备修改] → 冲突保留当前输入，由用户决定何时刷新。

## Migration Plan

不涉及 API 或数据迁移，可独立回滚手机端入口。静态检查、单元行为、390×844 运行时、iOS JS 导出与设备/provider 边界分别记录。
