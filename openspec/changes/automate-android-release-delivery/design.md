## Context

既有 Vercel 与两个 Pages 已绑定本仓库，推送即触发构建，main 为生产分支。APK 约 85 MB，超过 Pages 单文件 25 MiB 限制。用户已授权完成实施、提交和 PR 发布，真机测试由用户执行。

## Goals / Non-Goals

目标：同一 PR 交付代码与构建，合并后生成可安装的生产 APK，固定入口不指向失败版本。非目标：iOS、商店发行、改动 Google/AI 配置、自动在任意 PR 执行生产数据库迁移、扩大现有供应商访问权限。

## Decisions

- 复用现有 Git 集成；GitHub Actions 用固定 action commit、Node 24.21.0/pnpm 12.3.4/Java 21，Expo Android-only prebuild 后 Gradle assembleRelease，arm64-v8a。PR 使用只读权限，仅 main 发布 job 获取 contents:write，不使用 pull_request_target。
- APK 存 GitHub Releases，标签绑定完整提交；先创建草稿并上传 APK、SHA256SUMS、android-release.json，再标为 latest。相较 R2 无新增账号/token/账单；相较 Pages 直接上传满足体积限制。
- `/downloads/android.apk`、`/downloads/android.json`、`/downloads/android` 通过 Pages worker 固定重定向到本仓库 latest 资产/说明。仅 GET/HEAD，不转发凭证、忽略查询参数，不新增 UI。
- API 响应提供经严格 SHA 格式检查的 x-slogan-commit；Pages 包装 release.json 包含 CF_PAGES_COMMIT_SHA。发布 job 校验三个 provider 的对应提交状态和三个实际生产地址的提交，不只看 HTTP 200。
- 保持现有 Expo 受控 debug 签名证书并校验固定指纹；自动版本 code=1000+run_number。它不是商店生产签名。APK 内 app.config 保存公开提交/API 元数据；验证器检查包名、版本、arm64、adjustResize、非 debuggable、证书和实际 bundle URL。
- 发布前再检查 main HEAD，防止旧构建覆盖新版本；失败草稿不标 latest。当前四个迁移已完成；未来 schema 变更需备份与兼容迁移后再发布，不给不受信任 PR 生产数据库秘密。

## Risks / Trade-offs

- [第三方部署迟到] → 有界等待和明确失败，保留上一下载版本。
- [并行版本覆盖] → 发布串行 + main HEAD 复核 + 草稿上传完成后发布。
- [签名漂移] → APK 证书指纹不符立即失败；正式私钥迁移需要独立受控流程。
- [Beta 队列、供应商故障] → 原房间 change 的真实云端队列验收独立记录；自动构建不宣称音频已验证。

## Migration Plan

将工作流与固定入口随现有发布分支提交，通过 PR 合并到 main；跟踪生产部署及工作流，确认公开下载与校验元数据。失败先修复后重跑；无需回退已成功的增量迁移。回滚时保留历史 Release，显式选择上一已验证包与匹配服务端，不回退业务 LEFT/ENDING 状态。
