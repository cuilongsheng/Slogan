# 手机端房间语音处理选择与同意验收

2026-09-28，本地实现对应 `implement-mobile-room-processing-consents`。

## 行为

- 即时和预约建房将敏感语音识别、会后关键词分别默认关闭，提交时显式发送两个布尔值。开启任一目的时，先读取本人当前同意状态；用户须逐目的主动接受，服务端当前说明版本与客户端文案版本不一致时禁止继续。后端拒绝未启用服务或缺少同意时页面展示对应错误，不显示创建成功。
- 房间列表和详情在加入前显示服务端保存的两项处理选项，包括关闭状态；启用目的的房间在规则页逐目的要求当前同意。读取失败清空旧状态，不能凭缓存放行。失败命令重试沿用原 `clientRequestId`。
- `/me/room-processing` 展示两项目的及独立撤回。页面明确撤回仅影响未来处理，不删除历史审计和已产生的安全案件。

## 本地证据

- 手机端 lint、typecheck、iOS JS export 通过；Jest 40 suites、106 tests 通过。iOS export 仅证明 JS bundle 可导出。
- `tests/e2e/mobile-room-consents-visual.e2e.spec.ts` 390×844 浏览器夹具 2/2，通过双目的独立接受门禁与单项撤回；创建页视觉夹具 1/1。截图如下。
- `openspec validate implement-mobile-room-processing-consents --strict` 通过。

![建房默认关闭](assets/mobile-create-processing-390-visual-fixture.png)

![入房逐目的同意](assets/mobile-room-consents-390-visual-fixture.png)

![个人撤回](assets/mobile-room-privacy-390-visual-fixture.png)

## 边界

新增处理选择与同意区域是根据已批准 V2 视觉语言和 OpenSpec 要求补充的交互，不是原 Figma 帧逐像素还原。处理说明文案来自当前 OpenSpec 约束；上线前仍须完成产品及隐私文案确认。浏览器夹具不替代真实账户、LiveKit/STT provider、原生设备权限和双端房间验收。本机后端配置默认关闭两项 provider 能力，开启选择时服务端会拒绝创建。
