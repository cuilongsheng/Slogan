# 房间与手机体验修正：验收记录

2026-10-08，OpenSpec `simplify-room-and-mobile-experience`。原实现基线为 develop `716cc0bd0fd4e0010721f0e0ac3c77eec4522436`；PR #9 已合并为 main `fc7bbf86cb28ee315c6e57e4d2a62a0dfc8e56d3`，四个生产迁移和三个生产部署已完成。以下区分本地、预览与生产证据，后台清理补丁基于该 main 提交。

结果：后端合同、行为实现、本地故障恢复测试和 Android 构建已通过。完整视觉、真机音频/键盘和云端消费者验收未完成；本 change 未归档。不能声称全部完成或全局 `1:1 PASS`。

## 原因和修正

| 用户反馈                 | 原因                                           | 已实现的处理                                                                                     | 当前证据与边界                                                                                         |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 后台混入历史房间         | 默认查询没有当前运营集合边界                   | 服务端 `scope=CURRENT` 只返回 OPEN/SCHEDULED，绑定筛选和游标；页面每 15 秒更新                   | PostgreSQL 混合五种状态、筛选/权限测试及浏览器结束后消失通过；历史记录保留                             |
| 卡片折叠、类型和标识难读 | `<details>`、UUID 主展示及技术枚举             | 全部详情直接展示，中文即时/预约房间，话题作为标题                                                | DOM/浏览器通过；完整视觉仍 PARTIAL，见下方差异                                                         |
| 我的没有退出             | 未接入已有 auth logout                         | 只保留限制与申诉、词汇、退出；清理本地凭证并请求撤销会话                                         | auth 测试与真实页面浏览器操作通过；浏览器截图不能证明 Android 字体/安全区                              |
| 键盘盖住输入             | 固定页面尺寸/底部操作，缺少页面级避让          | 共享壳 KeyboardAvoidingView、表单滚动及 Android adjustResize                                     | typecheck/build 和 APK manifest 通过；实际焦点/键盘录像 BLOCKED                                        |
| 等级只能单选             | 房间合同及存储只有代表单级                     | 新增最小/最大等级，直接可见两组选择；旧单级及组合枚举兼容                                        | 本地迁移、B1–B2 HTTP 创建/读取、客户端提交通过；四个远程迁移已执行并核对                                         |
| 房间输入错接 AI          | composer 是打开翻译弹层的触摸入口              | 独立文字消息 POST/GET、滚动增量读取、发送失败幂等重试；退出/后台取消轮询                         | 两成员真实 HTTP、权限/清理/限流及页面组件测试通过；双 Android 的实际显示待验证                         |
| 母语表达繁琐             | 多模式、多次确认和多候选；缺少静音恢复编排     | 按住确认静音后录音，松开或 10 秒停止、开麦、自动翻译，只显示主英文；保留首次有效用途同意及撤回   | 竞态/取消/同段 UUID/失败恢复测试通过；按住/松开与结果组件浏览器截图通过；真实 STT/AI、双设备隔离待验证 |
| 退出像重新加入           | 退出串行等待媒体和后端，失败混入连接状态       | 普通成员与独自房主直接退出；其他在线成员存在时房主明确选接任者；独立退出未确认状态，以原代次重试 | 角色组件、会话状态、并发/响应丢失测试通过；真机本地音频停止待验证                                      |
| 最后一人仍等待 LiveKit   | 事务提交后同步 dispatch，provider 失败误报 503 | leave 提交后返回 LEFT/PENDING；持久命令由 Vercel Queues 私有消费者恢复清理                       | provider 失败时 HTTP 成功、命令恢复、本地 Vercel 双函数构建通过；云端实际触发未执行                    |

普通文字是纯文本，最多 1000 Unicode 码点，五秒最多五次新发送；同 UUID/同内容重试不会重复存储。初始最近 50 条、增量游标读取、客户端保留最多 300 条；只在当前房间可读写，结束清理正文。没有添加历史聊天、房间转写或自动播报能力。

## API、迁移和队列

唯一合同仍由 NestJS code-first 生成到 `openapi/openapi.yaml` 和 api-client；本次没有第二份手写合同。新文字消息与等级范围已在 fc7bbf8 生产 API 验证；后台清理仍未通过。Google 登录保持本次开始时的状态，没有开启或修改密钥。

四个增量迁移先在隔离 PostgreSQL 验证，2026-10-07 已在授权的 Neon main / neondb 执行并核对：

- `20261007100000_room_level_ranges`
- `20261007100100_room_text_messages`
- `20261007100200_room_level_range_upper_bound`
- `20261007100300_room_message_foreign_keys`

验证覆盖旧 B1_B2/C1 数据回填、空字段旧写入兼容、上下限约束、消息外键级联、消息幂等及关闭清理；未改写历史迁移。

Vercel 模式使用 `@vercel/queue` 发布短任务，独立 `api/realtime.func` 是私有消费者；公开 `index.func` 承接 HTTP。本地 `vercel build` 成功，触发元数据见 [vercel-local-build.json](vercel-local-build.json)。本地临时项目设置已删除。发布分支的 Vercel 和两个 Pages 预览构建已成功；PR #9 已合并，生产提交为 fc7bbf8；实际清理命令六分钟仍未执行，恢复补丁待上线复核。非 Vercel 环境保留 BullMQ；独立 Node worker 是可选部署方式，不要求另买服务器。

队列失败重投递、数据库扫描恢复、重复投递和 next-scan 发布失败测试通过。平台 beta/用量/保留期、播种失败及扫描断链恢复仍需要线上验证；不能把 SDK mock 或本地构建当成持续运行证明。发布顺序和回滚见 [Vercel 队列方案](../../deployment/room-experience-vercel-queues.md)。

## 已执行验证

| 范围                                          | 结果                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| API typecheck / lint / build / openapi:check  | PASS                                                                                                |
| API unit                                      | PASS，40 suites / 228 tests                                                                         |
| API integration，隔离 PostgreSQL              | PASS，38 suites / 199 tests                                                                         |
| API HTTP e2e，隔离 PostgreSQL                 | PASS，18 suites / 99 tests                                                                          |
| mobile typecheck / lint / Jest                | PASS，45 suites / 131 tests                                                                         |
| admin typecheck / lint / Vitest               | PASS，3 tests                                                                                       |
| 相关 Playwright                               | PASS，后台 3、创建/预约 2、我的 1；明确 API fixture 的页面行为测试                                  |
| 语音房 Playwright                             | PASS，1 test；实际 VoiceRoomScreen 与生成客户端，明确会话/录音/HTTP adapters；包含未选择/选择接任者 |
| admin / mobile Pages 构建                     | PASS；均产出静态页面、API proxy worker 和路由                                                       |
| Pages proxy 单测                              | PASS，11 tests                                                                                      |
| dependency-cruiser / OpenSpec strict validate | PASS                                                                                                |
| 本地 Vercel build                             | PASS，公开 API 和 queue/v2beta 私有消费者两个独立产物                                               |
| Android assembleRelease / APK 签名            | PASS；arm64-v8a、API 24+、v2 签名、adjustResize                                                     |
| 受影响文件 Prettier / git diff --check        | PASS                                                                                                |

`pnpm deps:check` 的 workspace audit 仍因现有 admin `@tanstack/react-query` deferred dependency 失败；单独依赖边界扫描通过，未删除或修改该无关依赖。没有将整个仓库的全量 verify 标为通过。

浏览器测试使用明确 fixture，不证明公开部署或真实 provider；服务器 HTTP 测试使用真实隔离数据库但不连接实际 LiveKit/STT。组件测试 mock 媒体适配器，不能证明设备音频隔离。没有修改供应商配置或读取密钥来伪造证据。

## Figma 与实际页面对照

全部原图经 Figma Desktop Bridge 导出，文件 `56nIowZmvBhb0QJvOlDQdU`，页面 `102:2766 / 02 UI`。原始 Frame 未改写；新增状态在单独 Section。原图、并排对照及“我的”透明度叠加见 [comparison.html](comparison.html)。已实际查看图片，没有裁剪、改色或修改运行图来隐藏差异。

| 目标 / 路由          | 原稿与运行                                                                                                                                                                                                                      | 平台 / 条件                                                                | 结论                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 我的 `/me`           | [152:1467](me-figma-original.png) / [运行](me-runtime-fixture.png)                                                                                                                                                              | Chromium，390×844，zh-CN，字体加载后；三个入口                             | 位置与尺寸、源字体字重已对照；Android 未捕获，不报全平台 1:1                                          |
| 创建 `/rooms/create` | [111:979](create-figma-original.png) / [运行](create-runtime-fixture.png) / [新增范围 153:1485](create-range-v3-figma.png)                                                                                                      | Chromium，390×844，B1–B2，4 人，无密码                                     | PARTIAL；范围直接可见、标签已对齐，新增范围与既有用途控制使页面需滚动；完整垂直布局和状态仍待视觉验收 |
| 预约创建             | [121:3613](create-scheduled-figma-original.png) / [运行](create-scheduled-runtime-fixture.png)                                                                                                                                  | Chromium，390×844，日期时间 + B1–B2                                        | PARTIAL；日期与合同已验证，完整表单/选中/滚动/键盘状态未全部对照                                      |
| 后台 `/rooms`        | [114:1602 原稿](admin-figma-original.png) / [153:1524 补充](admin-v3-figma.png) / [运行](admin-runtime-fixture.png)                                                                                                             | Chromium，1440×900，Asia/Shanghai，固定 2026-09-28 16:04，3 条当前 fixture | PARTIAL；导航资产、状态、箭头与详情几何已校准；全状态字形/基线及不同数据布局仍需验收                  |
| 语音房               | [115:1425](voice-figma-original.png) / [运行组件](voice-runtime-component-fixture.png)                                                                                                                                          | Chromium，390×844，确定性四成员与消息 fixture                              | PARTIAL；header/LIVE、成员、源资产及消息输入已对照；缺 Android 与真实媒体证据                         |
| 按住 / 结果          | [115:1627](translation-hold-figma-original.png) / [按住组件](translation-hold-runtime-component-fixture.png) / [115:1720](translation-result-figma-original.png) / [结果组件](translation-result-runtime-component-fixture.png) | Chromium，390×844，录音与英文返回 adapter                                  | PARTIAL；短流程及原稿几何已对照；真实 STT/AI 与 Android 未执行                                        |
| 房主移交             | [111:906](host-handoff-figma-original.png) / [未选择](host-handoff-runtime-component-fixture.png) / [已选择](host-handoff-selected-runtime-component-fixture.png)                                                               | Chromium，390×844，三位可接任者                                            | PARTIAL；深色弹层及明确选择行为已验证；缺原稿选择/禁用变体与 Android 证据                             |
| 首次有效同意         | [运行组件](translation-consent-runtime-component-fixture.png)                                                                                                                                                                   | Chromium，390×844，当前 notice 的 REQUIRED → ACCEPTED fixture              | 行为与截图已有；没有用标准结果稿假装首次同意设计状态，完整视觉仍待验收                                |

区域检查：

- 页面壳：我的 web 背景、标题、按钮几何与字体属性已对照；Android 状态栏、安全区与键盘未验证。
- 卡片与控件：当前房间完整展开，创建范围两组直接可见；后台品牌、导航、卡片尺寸、详情间隔、状态和筛选箭头已再次修正并重新截图。完整数据和交互状态仍未全部闭环。
- 字体：从源节点复核 Noto Sans SC 字重，共享静态 400/500/600/700 已打包。Android 字形/基线仍需实机验证。全字形字体使 APK 约 85 MB、web 字体约 42 MB，是当前体积成本。
- 资产：后台六个导航 SVG、语音房导航/规则/发送/麦克风/房主/装饰和四种国旗由 Desktop Bridge 导出；生产代码不使用 fixture 头像。
- 行为与原稿的边界：原稿舞台示例引语没有真实转写合同，本次不伪造转写；房主必须明确选择后才能移交，未选择按钮禁用；有效处理同意与可访问撤回路径按批准需求保留。这些业务状态的完整原稿变体仍需补齐，不能报全局 1:1。
- 语音浏览器框架直接运行生产 VoiceRoomScreen、消息/翻译生成客户端与真实样式，使用独立的会话、媒体、权限和 HTTP adapters。它不是新增产品路由，不证明 Expo 原生路由、LiveKit、真实录音、STT 或 Android。
- 状态：已有语音房、按住、英文结果、移交选择与首次同意浏览器截图。设备键盘、真实录音、英文结果与房间音频恢复没有设备截图/录像。

Desktop Bridge 最后一轮读取和导出已恢复；此前问题是实例后代节点的直接 ID 查找超时，改为从所属 Frame 查找后成功。没有使用 cloud/REST/browser 回退。没有待用户重启桥接的阻塞。

## Android 与剩余门槛

本轮追加修复了 Android 启动器 Logo：Expo 的普通及自适应图标已连接项目 Logo，Android-only prebuild 后重新构建；最终 APK 的 15 个图标资源与生成文件逐字节一致，Manifest 与 adaptive XML 引用正确。图片见 [APK 内实际图标](android-launcher-from-apk.png)，校验见 [android-logo-build.json](android-logo-build.json)。这证明打包资源已替换，不代替真机启动器验证。

最新 APK、签名/哈希/API 及安装边界见 [Android 发布记录](../../releases/2026-10-07-room-experience-android.md)。这是受控安装产物，不是商店正式发行。没有触及 iOS。

用户明确自行执行真机测试；代理没有真机 PASS 证据。用户设备验收范围：登录/资料/创建/消息/笔记键盘；两机消息显示；旁听者听不到私人录音；松开后恢复对话；切后台/失败/取消/离房无残留采集；退出立即停本地媒体。需两台设备完成音频隔离证据。

四个线上迁移已完成，见 [迁移证据](production-migrations.json)；5 个账号登录及 admin/mobile 同源浏览器 exchange、HttpOnly cookie、logout 已在线验证，见 [认证证据](production-auth-smoke.json)。Google capabilities 为 false。API 和客户端生产发布已完成，消费者触发和 provider 恢复采样仍待完成。固定下载已指向与生产一致的 0.0.7 APK；不能把交付成功等同于后台清理验收。

OpenSpec 未完成项保留未勾选；在视觉、真机、云端门槛满足前不归档，也不宣称这七项全部完成。

2026-10-08 的 [真实生产房间检查](production-room-smoke.json) 证明范围、消息和快速退出；响应外清理未通过。请求内追踪播种与失败重试已补充本地验证，不能代替重新部署后的独立消费者证据。

## 2026-10-08 后台恢复补丁本地验证

`pnpm --filter @slogan/api verify` 完整通过：lint、typecheck、40 个 unit suites / 229 tests、38 个 integration suites / 199 tests、20 个 HTTP e2e suites / 106 tests、build 和 OpenAPI 合同检查。新增 HTTP 测试证明请求上下文保留、发布未完成时 HTTP 已返回，以及失败日志只含安全分类；队列单测覆盖首次失败重试、并发去重和五分钟后重新播种。两个 OpenSpec 严格检查、冻结依赖安装和 diff 检查通过。这些是本地证据，部署后独立清理仍需重验。
