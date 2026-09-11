# Mobile Frontend Rules

## Stack and Routing

- 移动端使用 React Native + Expo + TypeScript，不引入第二套移动框架。
- 移动端使用 React Native StyleSheet 和 semantic theme tokens；不因 PC 使用 Tailwind 而共享 DOM 样式或默认引入 NativeWind。
- 顶层 `app/` 由 Expo Router 管理文件路由和 route layout；业务实现放在 `src/features/`。
- Route 文件只读取参数、组合 providers/feature screen 和声明导航选项，不直接实现 API、LiveKit 或权限流程。

## Feature and Device Ownership

- 移动端按 `auth`、`profile`、`room-discovery`、`voice-room` 和 `reporting` 等业务 feature 组织。
- 麦克风、系统权限、安全存储、设备语言和实时连接 SDK 封装放在 `src/services/`。
- `voice-room` feature 编排房间行为；`services/realtime` 只封装 LiveKit 技术能力，不决定房主移交、踢人或重入规则。
- 根 `components/ui` 只放跨 feature 的 React Native primitives；不得从 PC 管理端共享 React DOM 组件。
- Platform-specific 文件使用 `.ios.*`、`.android.*` 或 `.native.*` 明确表达，禁止在业务组件散落无法测试的平台判断。

## Permissions and Lifecycle

- 麦克风权限必须显式处理未询问、允许、拒绝、永久拒绝和系统设置返回后的状态。
- App 前后台切换、系统中断、音频设备变化和网络断开不得静默破坏房间状态。
- Token、账号凭证和敏感本地状态使用安全存储；不得写入普通日志或未加密持久化。
- 设备语言只提供默认值；实际语言行为遵循 current requirements，不在服务层自行增加产品规则。

## Realtime UI

- 明确区分应用房间状态、LiveKit 连接状态和本地麦克风状态，不以单个布尔值代替三者。
- 所有订阅、事件监听和重连定时器必须在生命周期结束时清理。
- 网络恢复后必须重新通过服务端状态确认成员资格，不能只相信客户端缓存或旧 token。

## Testing and Evidence

- 纯逻辑、hooks 和 adapters 使用适合的单元/集成测试。
- Playwright 可以覆盖相关 Web 管理流程，但不能作为 React Native 真机验收证据。
- 麦克风权限、系统语言、前后台切换、网络重连和音频发布/订阅需要模拟器或真机 runtime evidence。
- 涉及 Figma 的移动页面必须在目标设备尺寸下与原始 frame 比较并记录差异。
