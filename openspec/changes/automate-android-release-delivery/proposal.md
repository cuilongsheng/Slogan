## Why

当前 API、两个 Pages 与 Android 包分散发布，用户无法从一个固定地址安装与线上合同一致的最新 APK。用户已明确要求继续完成原发布，并直接提交、提 PR、触发部署，安装验收由用户执行。

## What Changes

- 同一仓库 PR/分支提交触发已有 Vercel、admin/mobile Pages 预览及自动 Android APK 构建；合并 main 触发生产部署。
- 生产三项部署与运行提交核对成功后，发布该提交的 APK、校验值及版本元数据到 GitHub Releases。
- 手机站点提供固定 APK/版本下载入口，失败构建不改变最新可下载版本。
- 固定 Node/pnpm/Java、依赖锁、Android 配置、签名证书及递增版本号，明确受控安装而非商店发行。

## Capabilities

### New Capabilities

- `android-release-delivery`: Android 自动构建、生产部署门槛、可追溯下载和失败恢复。

### Modified Capabilities

无现有产品业务需求变化。

## Impact

影响 Architecture、Test/Acceptance、Deployment；涉及 GitHub Actions、构建脚本、Expo 配置、API 提交响应头、Pages 发布元数据及固定下载重定向。不新增应用页面、不修改 Google/AI 配置、不公开业务秘密、不引入 iOS 或商店发布。本轮四个数据库迁移已按授权完成；未来数据库变更仍必须先备份及明确迁移/回滚处理，不在不受信任 PR 中执行生产迁移。
