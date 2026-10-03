# implement-mobile-room-discovery-join 验收记录

## 目标与设计证据

- 日期：2026-09-25。Figma Desktop Bridge 已实时连接 `Slogan` 文件 `56nIowZmvBhb0QJvOlDQdU` 的 `02 UI` 页；通过插件 `exportAsync` 获取原始帧截图，均为 390×844。
- 列表 V2 `115:1197`：[原稿](assets/implement-mobile-room-discovery-join-rooms-list-v2.png)。关键坐标：标题 x20/y51；筛选行 y123；首张房间卡 x16/y204/358×132；底部导航 y764。
- 详情 `111:1026`：[原稿](assets/implement-mobile-room-discovery-join-room-detail-v1.png)。房间卡 x16/y178/358×124；成员区 y368；入房方式卡 y563；主按钮 y744。
- 密码 `111:1071`：[原稿](assets/implement-mobile-room-discovery-join-join-password-v1.png)。目标卡 y178；四位密码卡 y368；规则提示 y580；主按钮 y744。
- 规则 `114:2508`：[原稿](assets/implement-mobile-room-discovery-join-join-rules-v1.png)。三张规则卡 y190/308/426；主动确认 y565；主按钮 y689。
- 设备检查 `114:2509`：[原稿](assets/implement-mobile-room-discovery-join-join-device-ready-v1.png)。麦克风状态卡 y157；检查卡 y429；主按钮 y689。

## API 合同对照

| 能力                 | OpenAPI / 结论                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公开即时房间列表     | `GET /v1/rooms`，Bearer，支持 `cursor`、`limit`、CEFR 和主题筛选；返回 `items`、`nextCursor`。`READY`。                                                         |
| 房间详情             | `GET /v1/rooms/{roomId}`，Bearer，返回可见性、主题、CEFR、房主昵称、人数/容量、开始/结束时间、密码状态、敏感语音识别状态、当前 membership 和分享 URL。`READY`。 |
| 入房前成员头像与名单 | `GET /v1/rooms/{roomId}/members` 要求活跃 membership；列表/详情也无头像字段。`MISSING`，不得展示设计稿中的示例人物。                                            |
| 总房间数与语言筛选   | 列表仅返回游标，无 total 或 room language。`MISSING`，不得把已加载数量称为总数，也不得提供假筛选。                                                              |
| 实际加入             | `POST /v1/rooms/{roomId}/memberships` 支持密码与规则确认，但语音房客户端未交付；本批不调用，避免占用名额。合同 `READY`，前端集成留待后续语音房 change。         |
| 麦克风               | 设备权限与可用性由前端 platform adapter 处理，无 HTTP 合同。原生设备验收待执行。                                                                                |

## 实现与运行证据

- 合格用户默认进入 `/rooms`；`/ready` 旧入口转至列表。列表、详情、密码、规则和设备检查页面均使用资格 gate。Chrome 中已有真实登录会话在 `http://localhost:8082/rooms` 恢复成功，API `http://localhost:3000` 返回空列表，页面显示空状态和已加载 0 个房间。该结果是当前开发数据库的真实结果，不是样例房间。
- 列表调用 `GET /v1/rooms` 并支持下拉刷新和游标下一页；详情在打开时重新调用 `GET /v1/rooms/{roomId}`。密码只保存在内存中的当前房间草稿，刷新及换房清除；规则须主动勾选。设备页仅在用户按下按钮时申请麦克风，Web 检查后释放媒体轨；Native 用 `expo-audio` 权限和可用输入检查。房间流程没有 `POST memberships` 或实时凭证调用。
- 2026-09-26 用独立临时测试账号通过现有 `RoomsService.create` 在开发数据库创建一间真实公开密码房。已登录 Chrome 会话刷新后调用真实 API，列表显示 1 个房间；列表卡 x16/y204/358×132、详情卡 x16/y178/358×124、成员区 y368、入房方式卡 y563 均与源稿主要布局对齐。卡片改用源稿的柔和彩色分区，人数改为圆角徽标。验收后已删除该测试房间和独立测试账号，未留下样例数据。
- Mac 会话锁定使 Chrome 点击超时；改用项目已有 Playwright 启动隔离 Chromium（390×844、`zh-CN`），以独立测试账号的 HttpOnly refresh Cookie 连接真实本地 API。完整走通列表 → 详情 → 四位密码 → 主动勾选规则 → 设备检查，页面脚本错误 `0`、membership / realtime 请求 `0`。浏览器麦克风使用 Playwright 授权和 Chromium 模拟音频设备，显示“已准备好”；这是 Web 模拟设备证据，不是真机音频证据。
- 运行截图：[列表](assets/implement-mobile-room-discovery-join-runtime-list.png)、[详情](assets/implement-mobile-room-discovery-join-runtime-detail.png)、[密码](assets/implement-mobile-room-discovery-join-runtime-password.png)、[规则未勾选](assets/implement-mobile-room-discovery-join-runtime-rules.png)、[设备未检查](assets/implement-mobile-room-discovery-join-runtime-device-idle.png)、[设备已准备好](assets/implement-mobile-room-discovery-join-runtime-device-ready.png)。规则卡实测 y189/307/425，源稿 y190/308/426；设备状态卡实测 y157、检查卡 y429，与源稿一致；主按钮位置也与源稿对齐。密码页目标卡比源稿低约 7px，其余主要卡片位置接近源稿。
- 移动端 lint、typecheck PASS，17 套 52 个测试 PASS（含麦克风永久拒绝状态分类）；依赖边界检查此前 PASS；Web 导出、iOS JS 导出与 OpenSpec strict PASS。iOS JS 导出不等于安装开发构建或真机检查。
- 真机麦克风权限、可用输入及 Google 原生会话：`BLOCKED`，当前没有可用模拟器/设备证据。Web 的权限拒绝和无设备由适配器测试覆盖；没有把模拟设备当作真实硬件验收。

## 设计差异和合同缺口

- 设计稿的成员头像与名单、服务端总房间数、语言筛选没有相应可用 API 字段，页面显示已加载数量和真实房主文字，不渲染示例头像。列表只显示“全部”筛选外观。
- 设计稿底部的“找伙伴／消息／我的”和创建房间图标当前仅为禁用的视觉入口，对应功能需各自的 change；当前可用入口为“发现”。
- 页面语言沿用设备语言；已用 `zh-CN` Playwright 预览对照中文原稿，真实 Chrome 英文会话的文案换行仍随语言变化。
- 设备页主操作改为“检查麦克风”，并明确说明尚未进入房间或占用名额，因为语音房客户端尚未交付。
- 原生设备若系统禁止再次询问麦克风权限，页面显示设置入口；Web 拒绝与无设备仍分别归类。检查后释放 Web 音频轨，不启动房间实时会话。

## 范围说明

本批完成房间发现和入房前准备页面。设备页必须明确说明尚未实际加入；不能调用 membership 或实时凭证接口，也不能把页面预览称为可用语音房。
