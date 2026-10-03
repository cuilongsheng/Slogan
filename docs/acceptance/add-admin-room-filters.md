# 后台房间筛选验收记录（2026-09-28）

- Figma Desktop Bridge 现场核对 V2 房间页 `114:1602`。1440×900 运行时截图：[房间页](assets/admin-rooms-1440-visual-fixture.png)。四个控件、卡片位置与高度已对照；卡片展示真实 UUID 缩写和真实时间，设计稿 `R-2409` 友好编号无合同字段。
- `GET /v1/backoffice/operations/rooms` 增加可选 `q/status/visibility/from`。主题包含查询忽略大小写，完整 UUID 精确查询；组合条件在 PostgreSQL 执行，游标与规范化条件绑定。旧无筛选请求保持兼容。查询审计只记录是否筛选，不记录原始搜索词。
- PostgreSQL 集成测试覆盖组合筛选、两页不重复、UUID 精确命中、旧条件游标用于新条件时返回验证错误。HTTP E2E 以真实数据库记录验证已授权筛选返回、非法状态 400、分析员 403。浏览器 Playwright 验证控件提交生成完整查询参数和 1440×900 渲染。
- API lint/typecheck、OpenAPI 检查、客户端生成检查、管理端 lint/typecheck/test/build、Playwright 3/3 通过。浏览器视觉使用确定性夹具；未使用用户账号中的真实房间数据验证全部四种组合。
