# 监控入口与实施基线

检查日期：2026-10-14。基线 checkout：`develop` / `716cc0bd0fd4e0010721f0e0ac3c77eec4522436`。工作区已有其他 change 的修改；本 change 不覆盖或归档它们。

| 目标          | 工作区入口                                               | 实际产物路径                        | 默认状态与验收                                   |
| ------------- | -------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| Admin         | `apps/admin/src/main.tsx` / API transport                | Vite；`build:pages:admin`           | 默认关闭；需真实浏览器源码定位                   |
| Mobile Web    | Expo Router / Web services                               | `build:pages:mobile` / `dist-pages` | 默认关闭；需 Pages 同源 proxy 与 Web source maps |
| Android       | Expo Router / 原生 services / config plugin              | prebuild 后 Gradle release          | 默认关闭；需原生缓存前净化与真机补报             |
| iOS           | 同一 Expo 项目的 iOS adapter                             | 将来实际启用的 iOS release          | 未发布，不用 Android/Web 代替证据                |
| API           | `apps/api/src/main.ts` / `configureApiApp`               | Nest dist 与 Vercel 公共函数        | 默认关闭；单独验证 ESM 与过滤器                  |
| Realtime      | `apps/api/api/realtime.ts`                               | Vercel 私有队列函数                 | 默认关闭；实际消费、重试和完成心跳               |
| 常驻 realtime | `apps/api/src/workers/realtime/main.ts`                  | Nest 独立进程                       | 实际启用时验证，不和托管模式混用                 |
| Operations    | `apps/api/src/workers/operations/main.ts`                | 当前综合治理 worker                 | 不直接复用综合 runOnce 启动监控                  |
| 其他 worker   | auth-mail / room-speech                                  | Nest 独立进程                       | 仅对实际部署且启用的职责验证                     |
| 新监控调度    | 本 change 的私有 observability consumer / monitor worker | 独立 topic 或独立常驻进程           | 默认关闭；不能开启 retention                     |

## 依赖边界

- `implement-operations-data-governance-backend`：已有 incident、outbox、RBAC、依赖探测代码；`operational-alerting` 等仍在活跃 change，其真实 sink、定时运行、备份与删除证明验收不能由本 change 自动完成。
- `simplify-room-and-mobile-experience`：工作区含托管 realtime consumer、扫描续接和客户端快速离房。监控必须保留这些业务语义，不覆盖其未完成的云端/设备验收。
- 主规格 `backoffice-audit`：受保护后台技术事件不输出 stack；speech 相关主规格：任何观测通道不保存音频、转写或内容。
- 构建遵循 Node 24.21.0 / pnpm 12.3.4；不使用 ambient Node 替换基线。

## 发布证据边界

最近仓库记录 `docs/releases/2026-10-07-room-experience-online.md` 记载预览构建成功，但当时生产仍是旧提交，云端消费者与真机验证未完成。该历史记录不是 2026-10-14 的实时远端状态；本次未查询/修改远端配置。后续真实验收必须记录实际部署 SHA、消费者、build 和监控项目，不能将当前工作区当作线上版本。

## 私有输入与启用门禁

真实 DSN/project、数据区域/留存、访问人员、预算、通知接收人、heartbeat/sink endpoint 和上传凭证由目标环境负责人提供。实施阶段先使用隔离 transport，不读取已有 `.env` 或供应商秘密，不创建远端资源、购买计划或部署。
