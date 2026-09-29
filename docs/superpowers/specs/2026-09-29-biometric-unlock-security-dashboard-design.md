# 生物识别解锁与安全仪表盘设计

## 1. 背景与目标

PwdBook 当前使用主密码校验后在主进程内存中保存 `sessionKey` 和同步传输密钥。该流程安全边界清晰，但每次自动锁定后都要求用户重新输入主密码。项目已有基于已解密条目的弱密码和重复密码分析，但呈现为问题列表，缺少综合安全状态和持续改进入口。

本次改动包含两个协同但可独立关闭的能力：

1. 在 Windows Hello 或 macOS Touch ID 可用时，允许用户把当前会话密钥载荷绑定到系统生物识别。生物识别只用于本机保险库解锁，不替代主密码、恢复密钥或跨设备同步凭据。
2. 新增安全仪表盘，综合展示安全评分、弱密码、重复密码、最老未更新密码和 TOTP 覆盖率，并提供定位到首个问题条目的修复入口。

明确不做：Linux 生物识别、云端生物识别同步、保存明文主密码、未经用户确认批量替换第三方账户密码、把安全评分写入数据库。

## 2. 约束与成功标准

### 2.1 平台约束

- 生物识别设置只在打包后的 Windows/macOS 且平台报告能力可用时显示。
- 开发环境、Linux、无传感器、原生模块缺失或系统策略禁用时返回 `unavailable`；主密码解锁流程保持可用。
- 生物识别取消、失败、超时或载荷损坏时只回到主密码表单，并显示可翻译的原因。

### 2.2 安全约束

- 不保存主密码，也不通过可逆数据推导主密码。
- 生物识别载荷至少包含当前 `sessionKey` 和 `syncTransportKey`，二者都由系统凭据存储保护；载荷只在主进程中解密。
- 生物识别启用、禁用、主密码恢复重置、保险库重置都会使旧载荷失效或被删除。
- 自动锁定清空内存中的两个会话密钥；生物识别解锁前数据库内容仍不可读。

### 2.3 可验证成功标准

- 首次设置和安全设置都能清楚说明生物识别仅用于本地解锁，恢复密钥仍需单独保存。
- 可用平台上，启用后锁定并通过生物识别重新进入保险库；取消生物识别后能回到主密码解锁。
- 不可用平台不会显示误导性的启用开关。
- 仪表盘实时反映条目变化，并能打开首个弱密码或重复密码条目。
- 报告和评分有纯函数测试，IPC 和平台不可用分支有主进程测试。

## 3. 方案与架构

### 3.1 生物识别适配器

新增主进程服务 `src/main/services/biometricService.ts`，对上层只暴露以下概念：

- `getBiometricStatus(): BiometricStatus`
- `enrollBiometric(payload: BiometricPayload): Promise<void>`
- `unlockWithBiometric(): Promise<BiometricPayload>`
- `disableBiometric(): Promise<void>`

`BiometricStatus` 至少包含 `platform`、`available`、`enabled` 和可选的不可用原因。适配器内部按平台选择实现：

- Windows：动态加载 WinBio 原生模块（优先使用 `node-native-winbio`），执行 Hello 验证；系统凭据载荷使用 Electron `safeStorage` 或原生模块提供的用户绑定存储。
- macOS：优先使用 Electron `systemPreferences.canPromptTouchID/promptTouchID`；需要脚本桥接时再通过 `@napi-rs/osascript` 调用系统能力。载荷必须存入当前用户的 Keychain/安全存储。
- 其他平台或依赖不可加载：返回不可用，不抛出阻断应用启动的错误。

适配器通过小型内部接口隔离平台依赖，避免渲染层知道 `safeStorage`、WinBio 或 Keychain 细节。任何原生模块都使用动态导入，不能让模块加载失败导致 Electron 主进程启动失败。

### 3.2 生物识别载荷

定义版本化的内部结构：

```ts
interface BiometricEnvelopeV1 {
  version: 1
  vaultSalt: string
  sessionKey: string
  syncTransportKey: string
  createdAt: number
}
```

`sessionKey` 和 `syncTransportKey` 以 base64 编码后组成 JSON，交给平台适配器加密存储。`vaultSalt` 用于确认载荷属于当前保险库；主密码恢复或数据库重置后盐值变化，旧载荷必须拒绝。数据库 `app_settings` 只保存非敏感的启用状态和平台元数据，敏感载荷不写入 sql.js 文件。

### 3.3 生命周期与 IPC

新增 IPC：

- `biometric:status`
- `biometric:enroll`
- `biometric:unlock`
- `biometric:disable`

主进程流程：

1. `setupVault` 完成主密码验证并进入恢复密钥设置步骤；用户明确选择启用后，调用 `enroll`。
2. `unlockVault` 保留原实现；锁屏页面加载时读取 `status`，仅在 `available && enabled` 时显示生物识别按钮。
3. 生物识别按钮调用 `unlock`，主进程先完成系统验证，再读取并校验 envelope，最后调用 `unlockSession(sessionKey, syncTransportKey)`。
4. `lockVault`、自动锁定和窗口锁定不删除系统载荷，只清理内存会话；用户在设置中关闭时删除载荷并写入 disabled 状态。
5. `resetMasterPasswordWithRecovery` 和 `resetVault` 删除载荷，防止旧主密码生命周期继续解锁。

渲染层新增 `vaultApi` 方法及 `useAppState` 的状态封装。锁屏首次设置使用一个明确的勾选/开关步骤，说明“仅用于解锁本地保险库，不替代恢复密钥”。

### 3.4 安全仪表盘

扩展 `src/shared/passwordHealth.ts` 的纯函数模型，保留现有弱密码/重复密码问题明细，并增加：

- `score`：0-100 的整数总分。
- `strengthScore`、`uniquenessScore`、`recencyScore`、`totpScore`：四个可解释子分数。
- `oldestUpdatedAt` 与 `oldestEntryId`。
- `totpConfiguredCount`、`totpCoveragePercent`。

评分计算：

- 强度占 40%：`100 - weakRate * 100`。
- 唯一性占 30%：`100 - duplicateEntryRate * 100`。
- 更新及时性占 20%：按条目 `updatedAt` 距当前时间的比例计算，超过 365 天视为 0；无条目时取 100。
- TOTP 覆盖占 10%：`totpConfiguredCount / totalEntries * 100`；无条目时取 100。
- 总分为四项按权重加权后四舍五入并限制在 0-100。

时间相关函数接受 `nowMs` 参数，避免测试依赖真实时钟。空保险库显示中性状态，不把“没有条目”误报为危险。

新增 `SecurityDashboardView.vue` 和 `AppScreen` 值 `security-dashboard`。仪表盘包含评分环、四个关键指标、最老条目、按问题类型分组的修复入口。入口分两类：

- 弱密码/重复密码：选择首个问题条目，进入保险库详情并打开编辑状态；用户可使用现有密码生成器生成并确认新密码。
- TOTP 覆盖率/最老条目：定位到待处理条目并进入编辑，不自动猜测或写入 TOTP。

现有 `PasswordHealthView` 保留为详细问题列表；侧栏工具菜单新增“安全仪表盘”入口，详细页继续从仪表盘进入。

## 4. 数据流与错误处理

### 4.1 生物识别成功

`LockScreen -> preload -> IPC -> biometricService -> platform adapter -> envelope -> unlockSession -> VaultStatus`。任何敏感内容只在主进程短暂存在，IPC 返回值只包含 `VaultStatus`，不返回密钥。

### 4.2 生物识别失败

适配器将取消、拒绝、超时和不可用统一映射为稳定错误码；渲染层显示可翻译提示，并保持主密码输入框可用。载荷解密失败或盐值不匹配时自动删除损坏载荷并要求主密码重新启用生物识别，不尝试静默恢复。

### 4.3 设置更新

生物识别不是普通 `SecuritySettings` 布尔值的简单写入：启用必须经过一次实时生物识别验证和载荷写入成功；禁用必须删除载荷后再更新状态。主进程拒绝在锁定状态下执行启用/禁用。

## 5. 文件与模块边界

预期新增或修改：

- `src/main/services/biometricService.ts` 及平台适配器模块。
- `src/main/services/sessionService.ts`、`vaultService.ts`、`recoveryService.ts`、`settingsService.ts`。
- `src/main/ipc/handlers.ts`、`src/preload/api.ts`、`src/env.d.ts`、`src/shared/types.ts`。
- `src/shared/passwordHealth.ts` 与对应测试。
- `src/composables/useAppState.ts`、`src/App.vue`、`LockScreen.vue`、`SettingsView.vue`、侧栏和新增仪表盘组件。
- `src/i18n/locales/zh-CN.ts`、`src/i18n/locales/en.ts`。
- `package.json` / `package-lock.json` 仅在原生适配器实际需要时增加可选依赖，并保持动态加载。

不修改数据库表结构；仅复用 `app_settings` 保存非敏感状态。

## 6. 测试设计

### 6.1 纯函数与报告

- 弱密码、重复密码兼容现有测试。
- 评分权重、空保险库、全覆盖 TOTP、0 覆盖 TOTP、最老条目和固定 `nowMs`。
- 更新条目后报告实时变化。

### 6.2 会话与生命周期

- biometric envelope 序列化/校验、盐值不匹配和版本拒绝。
- 启用后锁定再解锁恢复两个会话密钥。
- 主密码恢复、保险库重置和禁用均删除旧载荷。
- 未解锁时拒绝管理生物识别。

### 6.3 平台与 UI

- 无原生模块、Linux、无传感器返回 `unavailable`，不阻断启动。
- 生物识别取消回到主密码表单。
- 锁屏仅在状态可用时展示按钮；设置页正确展示启用/禁用状态。
- 仪表盘入口、指标渲染、修复入口定位到正确条目。

发布前在 Windows Hello 和 macOS Touch ID 真机各验证一次；CI 只覆盖适配器 mock 和平台不可用分支。

## 7. 分阶段交付

1. 先实现并测试共享报告模型与仪表盘 UI，保证现有密码健康页无回归。
2. 增加 biometric service、IPC 和锁屏/设置流程，先接入不可用适配器与 mock。
3. 接入 Windows/macOS 原生适配器，完成真机验证与打包检查。
4. 最后补充文案、产品导览入口和发布说明。

