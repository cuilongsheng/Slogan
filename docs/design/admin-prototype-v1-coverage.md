# Slogan 后台管理原型覆盖

状态：**产品评审稿**。Figma 画布是视觉原型，功能以 `openspec/specs/` 为准；示例数据均为虚构标识。

文件：[Slogan / Admin Prototype / V1](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2007)。画布位于 `01 Prototype` 页，不覆盖移动端原型。桌面框尺寸为 1440 × 900。

| 页面 | Figma 节点 | 类型 | 需求依据与边界 |
| --- | --- | --- | --- |
| 房间管理 | [102:2010](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2010) | 卡片 | 用户指定卡片形式。当前主规格没有后台房间处置命令；卡片和筛选为待确认的信息架构。 |
| 安全案件 | [102:2041](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2041) | 表格 + [详情抽屉](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2642) | `safety-case-management`：分页、状态/时间/用户筛选、角色可见范围、人工处置与证据边界。 |
| 限制申诉 | [102:2072](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2072) | 表格 + [决定抽屉](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2671) | `safety-restriction-appeals`：安全员查看待处理申诉，维持/解除均需理由。 |
| 安全降级事件 | [102:2103](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2103) | 表格 | `room-sensitive-speech-detection`：按房间、时间、组件、状态只读查询。 |
| 后台角色 | [102:2134](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2134) | 表格 + [授予抽屉](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2692) | `backoffice-access-control`：多角色、原因、角色分离、最后管理员保护。撤销表单待下一轮细化。 |
| 操作审计 | [102:2165](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2165) | 只读表格 | `backoffice-audit`：按时间、操作者、动作、目标、结果分页查询；不提供编辑或删除。 |

## 可点击路径

- 原型入口：`后台管理 / 案件入口`，从安全案件页开始。
- 六个页面的左侧导航互相连接；分组、细选中态参考用户给出的后台截图，但布局与业务结构由 Slogan 定义。
- 安全案件表中的 `CASE-1041`、申诉表中的 `APL-302`、角色页的“授予角色”可以打开对应抽屉；抽屉可关闭，决定按钮进入[二次确认示意](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2714)。
- 筛选、搜索、分页、表单输入和真实提交目前是结构示意，没有数据联动。其他示例行不应被理解为已经实现独立详情数据。

## 产品评审点

1. 房间管理需要哪些后台权限和动作？当前仅能评审卡片信息与筛选，禁用、解散、移交等动作不能从参考图推导。
2. 案件列表和申诉列表是否需要额外列？角色专属可见范围需按当前会话验证。
3. 案件详情是否采用抽屉；证据缺失/降级/无风险信号等状态是否足够清晰。
4. 角色撤销与审计详情是否需要独立抽屉，或继续由表格行内操作承载。
5. 运营指标与治理视图属于活动中的后端变更，未纳入当前主规格原型；批准范围后再设计对应页面。
