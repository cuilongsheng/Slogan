# localization-and-room-rules Specification

## Purpose

定义当前版本的中英文界面选择和房间内规则入口，使不同设备语言的用户能够理解语音房的行为边界。加入流程由 direct-room-entry 定义。

## Requirements

### Requirement: 中英文界面选择
系统 MUST 在设备语言为中文时默认使用中文，在设备语言不是中文时默认使用英文；当前版本只提供中文和英文文案。

#### Scenario: 中文设备语言
- **WHEN** 用户首次打开应用且设备语言为中文
- **THEN** 系统默认展示中文界面

#### Scenario: 非中文设备语言
- **WHEN** 用户首次打开应用且设备语言不是中文
- **THEN** 系统默认展示英文界面

### Requirement: 房间内规则入口
系统 MUST 在用户进入语音房后保留可访问的房间规则入口。

#### Scenario: 房间内查看规则
- **WHEN** 房间成员打开规则入口
- **THEN** 系统以当前界面语言展示语音房的行为规则
