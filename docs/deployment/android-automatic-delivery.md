# 一个 PR 的前后端与 Android 交付

用户授权日期：2026-10-08。当前配置复用 `cuilongsheng/Slogan` 与现有供应商项目。

| 配置                          | 目标和触发                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Vercel `slogan-api`           | 根目录 `apps/api`，Git 分支推送触发预览，main 触发生产；独立 `api/realtime.ts` Queues 消费者与公开 API 一起发布                 |
| Pages `slogan-preview-admin`  | `pnpm build:pages:admin`，产物 `apps/admin/dist`；main 为生产                                                                   |
| Pages `slogan-preview-mobile` | `pnpm build:pages:mobile`，产物 `apps/mobile/dist-pages`；main 为生产                                                           |
| GitHub Actions                | `.github/workflows/android-delivery.yml`；同仓库 PR、codex 分支、main 推送与手动运行                                            |
| Android                       | Node 24.21.0 / pnpm 12.3.4 / Java 21，SDK/build-tools 36，NDK 27.1.12297006；Expo Android-only prebuild + arm64 assembleRelease |
| 版本                          | `versionName=0.0.<run_number>`，`versionCode=1000+run_number`，公开提交与 API 元数据内置                                        |
| 签名                          | 沿用已有受控安装证书，指纹固定；不符即拒绝发布，不是商店生产私钥                                                                |
| 发布                          | main 的三个供应商部署成功，实际 API 响应头与两个 Pages release.json 都是该提交；复核 main 未移动后，草稿上传完整再发布 latest   |
| 产物存储                      | GitHub Releases，每个完整提交一个 `android-<sha>` 标签；APK、`android-release.json`、`SHA256SUMS`                               |
| 固定地址                      | `https://slogan-preview-mobile.pages.dev/downloads/android.apk`；元数据 `.json`；版本说明 `/downloads/android`                  |

## 使用流程

后端已接入 Vercel Git 自动部署。配置入口为 `slogan-api → Settings → Git / Build and Deployment`：仓库 `cuilongsheng/Slogan`，Root Directory `apps/api`，Framework Preset `NestJS`，Production Branch `main`。API 构建脚本为 `prisma generate && nest build`。环境变量按用途配置到 Production 与 Preview；修改变量后需要重新部署才能生效。推送非 main 分支产生 Preview，PR 合并到 main 后产生 Production，不需要手动点击 Deploy。依据：[Vercel Git 部署](https://vercel.com/docs/git)。

这不包含数据库自动迁移：`prisma generate` 生成客户端，不执行迁移。当前生产部署没有自动运行 `prisma migrate deploy`；包含 schema 变更的发布需要先完成兼容迁移与备份，再发布依赖新 schema 的 API。Android 发布门槛核对部署提交，不能代替数据库迁移。

提交 PR 后自动执行预览部署和 APK 构建。PR 包位于 Actions artifact，使用既有生产 API；在 main 生产发布完成前，不把它描述成完整可用的新合同包。合并后构建与线上提交一致的 APK，自动发布到固定下载入口。用户安装该包执行真机验证。

Cloudflare Pages 每个文件最多 25 MiB，而当前 APK 约 85 MB，所以站点保存固定重定向入口，APK 保存到 GitHub Releases；不把 APK 提交到 Git，也不申请 R2 token。下载重定向只处理 GET/HEAD，目标固定，不转发会话 cookie 或 bearer token。

## 权限与失败处理

构建 job 仅 contents:read。发布 job 只在 main 运行，使用 GitHub 的当次 GITHUB_TOKEN 获取 contents:write/checks:read/statuses:read；不使用长期个人 token，不在 PR 中传递数据库、供应商或签名秘密，不使用 pull_request_target。Actions 固定官方 release commit，Gradle 使用 basic 缓存。

部署失败/取消/超时、生产提交不符、签名不符、旧构建完成时 main 已移动均停止 latest 更新。草稿上传失败可重跑；已发布的同提交 Release 不覆写。现有供应商 Git 集成保持各自部署，因此它们不是一个原子发布事务；迁移必须保持新旧 API 兼容，下载发布门槛负责阻止错配 APK。

数据库：本轮四个迁移已备份并成功完成，不重复初始化。未来 schema 变更仍需在明确的目标执行备份和兼容迁移，不能因为任意 PR 打开就执行生产迁移；本 workflow 不保存生产 DATABASE_URL。

## 验证边界

本地验证不能代替真实 Actions 运行、公开下载、云端队列或设备音频。首次上线必须记录 PR/main SHA、Actions run、三项部署、Release URL 和下载文件哈希。真机测试由用户执行，Google 仍关闭，iOS 与商店发行不在本轮范围。

依据：[Cloudflare 文件限制](https://developers.cloudflare.com/pages/platform/limits/)、[GitHub 自动触发](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)、[Expo 本地构建](https://docs.expo.dev/build-reference/local-builds/)。
