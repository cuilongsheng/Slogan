# PC 管理后台验收记录（2026-09-28）

## 实现和合同

- 六张已确认的 Figma V2 主页面对应房间、案件、申诉、降级事件、角色和审计；前端使用生成客户端和当前后台角色决定路由，服务端继续独立鉴权。
- 浏览器会话由 HttpOnly refresh Cookie 恢复，access token 仅存内存。真实本机 Google 账号通过受控 bootstrap 获得 `PLATFORM_ADMIN` 与 `SAFETY_OFFICER`，已在浏览器打开六页并读取角色、审计记录。
- 房间明细响应已补 code-first OpenAPI 结构。案件与申诉统计由新的全量 summary API 提供；“待处理案件”包含 `OPEN` 与 `UNDER_REVIEW`，遵守管理员/安全员可见范围；申诉统计仅安全员可读。失败显示未知值，列表仍能独立查询。
- 高权限命令在进入操作流程时生成并保留 `clientRequestId`，失败重试沿用同一标识；服务端成功后刷新相关查询。角色授予现在先在侧栏录入，再在敏感操作弹层确认；申诉决定在详情侧栏录入后确认。

## 验证

- `pnpm --filter @slogan/admin lint`、`typecheck`、`test`、`build` 通过。
- `pnpm --filter @slogan/api test:integration`：36 组、196 个测试通过。
- API E2E 的 summary 计数与普通账号 403 已通过；全套 API E2E 首次为 15/16 组通过，剩余用例因成员响应新增 `userId` 的旧预期失败。修正预期后该语音 HTTP 组 6 个测试通过。
- `pnpm exec playwright test tests/e2e/admin-visual.e2e.spec.ts`：六张主页面及四张覆盖层的 1440×900 确定性截图、统计与两步确认断言通过。截图已保存到 `docs/acceptance/assets/admin-*-1440-visual-fixture.png`，属本地视觉夹具，不是真实生产数据。
- `pnpm --filter @slogan/api-client generate:check` 通过；OpenSpec change 严格校验见任务执行记录。

## 六页视觉差异

| 页面 | 已有证据 | 与设计/合同的剩余差异 |
| --- | --- | --- |
| 房间 | [截图](assets/admin-rooms-1440-visual-fixture.png) | `add-admin-room-filters` 已接全量服务端主题/完整 UUID、状态、可见性与创建时间下界筛选；设计稿友好短编号仍无合同字段。 |
| 案件 | [截图](assets/admin-cases-1440-visual-fixture.png) | 三张卡使用全量统计；状态和 7/30 天服务端过滤可用。设计稿全文搜索未有对应合同。 |
| 申诉 | [截图](assets/admin-appeals-1440-visual-fixture.png) | 三张卡使用全量统计；合同只支持状态筛选，无全文搜索及时间过滤。 |
| 降级 | [截图](assets/admin-incidents-1440-visual-fixture.png) | 状态、组件和 7/30 天过滤可用；房间标识过滤尚无页面输入。 |
| 角色 | [截图](assets/admin-roles-1440-visual-fixture.png) | 角色筛选可用；用户查询尚无页面输入。 |
| 审计 | [截图](assets/admin-audit-1440-visual-fixture.png) | 结果及 7/30 天过滤可用；动作、目标与操作者查询尚无页面输入。 |

## 四张覆盖层视觉证据

| 覆盖层 | 运行时截图 | 当前差异 |
| --- | --- | --- |
| 案件详情 | [截图](assets/admin-case-detail-1440-visual-fixture.png) | 设计稿的 `CASE-1041` 等友好编号无 API 字段，界面显示截短 UUID；证据卡展示服务端实际内容。 |
| 申诉详情 | [截图](assets/admin-appeal-detail-1440-visual-fixture.png) | 设计稿的 `APL-302` 和 `RST-668` 无 API 字段，界面显示截短 UUID；决定已放在侧栏并加提交确认。 |
| 授予角色 | [截图](assets/admin-role-grant-1440-visual-fixture.png) | 录入字段与提示已对照；目标用户使用合同要求的 UUID。 |
| 敏感确认 | [截图](assets/admin-sensitive-confirm-1440-visual-fixture.png) | 420×280 左右的卡片、黄色警示与双按钮已对照；真实目标摘要来自选中记录。 |

## 尚未验收

- 六张主页面和四张覆盖层均已截图逐张检查；业务数据字段与设计占位文本存在上述差异，且字体渲染依赖操作系统，因此不宣称像素级 1:1。部分设计控件缺 API 合同或页面输入，详见上表。
- 本机没有真实待处理案件/申诉，因此案件处置和角色撤销的真实浏览器路径尚未做有数据验收。自动化验证了权限、确认、冲突和服务端命令。
- `OPERATIONS_ANALYST` 的独立指标工作台尚无已批准设计稿和对应前端 change。
