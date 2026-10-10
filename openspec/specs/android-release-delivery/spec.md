# android-release-delivery Specification

## Purpose

为受控 Android 安装验收提供与线上前后端一致、来源可追溯、签名连续的自动构建和固定下载入口，使用户能直接安装验证，并在发布失败时保留上一可用产物。

## Requirements

### Requirement: 自动构建可追溯 Android 包

系统 SHALL 在仓库可信分支提交和 PR 更新时自动构建 Android APK，记录来源提交、版本、API 地址、签名证书及 SHA-256；非生产构建 SHALL 不改变生产下载版本。

#### Scenario: 更新 PR

- **WHEN** 用户提交一个仓库内 PR 的新代码
- **THEN** 触发 Android 构建和已有前后端预览部署，产物可由工作流下载并识别来源提交

### Requirement: 生产发布门槛

系统 MUST 仅在目标 main 提交的 API、管理端和手机端生产部署均成功、运行提交一致后发布对应 APK。失败、超时、旧提交或取消的构建 MUST 不被标为最新下载。

#### Scenario: 某个部署失败

- **WHEN** API 或任一前端部署失败或运行提交不一致
- **THEN** 工作流报告失败，固定下载入口保留上一成功发布

#### Scenario: 旧构建延迟完成

- **WHEN** 更早 main 提交的构建在 main 已更新后完成
- **THEN** 该构建不能更新最新下载版本

### Requirement: 固定下载和覆盖安装

系统 SHALL 提供固定 HTTPS 下载入口，指向最新成功生产 APK，并提供匹配的版本元数据与校验值。受控安装签名 MUST 连续、版本号 SHALL 递增，构建不得包含生产秘密。

#### Scenario: 成功发布后安装

- **WHEN** 同一 main 提交的部署与 APK 核对成功
- **THEN** 固定地址可下载该 APK，并能用元数据核对提交、API、版本、SHA-256 和签名证书
