# GitHub Releases 自动更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 PwdBook 增加基于 GitHub Releases 的可控自动更新：默认后台检查并下载正式版本，用户可在“版本更新”设置中关闭自动行为，并手动确认重启安装。

**Architecture:** 主进程新增 `updateService`，封装 `electron-updater`、状态机和定时检查；通过现有 Electron IPC/preload 边界向 renderer 暴露快照、检查、下载和安装动作。现有 `SecuritySettings` 持久化 `autoUpdateEnabled`，设置页将“关于”栏目改名为“版本更新”并承载开关和更新状态。GitHub Actions 发布各平台原始安装资产、`latest*.yml` 和 blockmap 元数据。

**Tech Stack:** Electron 35、`electron-updater`、electron-builder 26、Vue 3、TypeScript、Vitest、GitHub Actions。

## Global Constraints

- 发布源固定为 GitHub Releases：`owner: Tianyu201809`、`repo: pwd-book`。
- 仅接受非 Draft、非 Prerelease 且版本号符合 SemVer 的 Release。
- 自动更新开关默认开启；关闭后停止启动检查、定时检查和后台下载，但仍允许手动检查并按需下载。
- 自动更新开启时启动检查一次，之后每 6 小时检查一次；下载完成后不自动退出。
- 只有用户点击“重启并安装”才调用 `quitAndInstall()`。
- 开发版、截图模式和没有更新元数据的平台不得发起更新网络请求。
- 支持 Windows x64 NSIS、macOS x64/arm64 DMG+ZIP、Linux x64 AppImage。
- 不增加 Windows 代码签名或 macOS 公证；使用 HTTPS provider、electron-builder SHA-512 元数据和 blockmap。
- Release notes 作为纯文本渲染，不使用 `v-html`。
- 不修改保险库、同步、加密或数据库格式。

---

## 文件与职责地图

| 文件 | 职责 |
| --- | --- |
| `src/shared/types.ts` | 增加 `SecuritySettings.autoUpdateEnabled`、更新状态类型、IPC channel/event 常量 |
| `src/main/services/sessionService.ts` | 设置默认值 `autoUpdateEnabled: true` |
| `src/main/services/settingsService.ts` | 读写本地设置键 `auto_update_enabled` |
| `src/main/services/updateService.ts` | 新增 `electron-updater` 封装、状态机、定时器、开关响应和安装动作 |
| `src/main/ipc/handlers.ts` | 注册更新 IPC，并在设置变更时通知更新服务 |
| `src/main/index.ts` | 在窗口/应用生命周期中初始化和销毁更新服务 |
| `src/preload/api.ts` | 暴露类型化更新 API 和状态监听取消函数 |
| `src/env.d.ts` | 同步 `Window.electronAPI` 更新 API 类型 |
| `src/components/SettingsView.vue` | 将“关于”栏目改成“版本更新”，增加开关、状态、进度和操作按钮 |
| `src/i18n/locales/zh-CN.ts` | 中文栏目、开关、状态和错误文案 |
| `src/i18n/locales/en.ts` | 英文栏目、开关、状态和错误文案 |
| `package.json` / `package-lock.json` | 添加 `electron-updater`、GitHub publish 配置和 macOS ZIP target |
| `.github/workflows/release.yml` | 发布更新所需的原始安装资产和元数据 |
| `src/main/services/updateService.test.ts` | 更新服务状态、版本过滤和开关行为测试 |
| `src/main/services/settingsService.test.ts` | 设置默认值和持久化读写测试 |

---

### Task 1: 增加自动更新设置模型与持久化

**Files:**
- Modify: `src/shared/types.ts:236-275`
- Modify: `src/main/services/sessionService.ts:1-30`
- Modify: `src/main/services/settingsService.ts:8-135`
- Create: `src/main/services/settingsService.test.ts`

**Interfaces:**
- Produces `SecuritySettings.autoUpdateEnabled: boolean`, default `true`.
- Produces `getSecuritySettings(): SecuritySettings` and `updateSecuritySettings(partial)` behavior for database key `auto_update_enabled`.

- [ ] **Step 1: Write the failing settings tests**

Mock `../db/helpers` with an in-memory `Map<string, string>` and mock `./sessionService.getDefaultSettings` with a complete default object. Add tests with these exact assertions:

```ts
it('defaults automatic updates to enabled when no stored value exists', () => {
  expect(getSecuritySettings().autoUpdateEnabled).toBe(true)
})

it('persists and reads a disabled automatic update setting', () => {
  const next = updateSecuritySettings({ autoUpdateEnabled: false })
  expect(next.autoUpdateEnabled).toBe(false)
  expect(getSecuritySettings().autoUpdateEnabled).toBe(false)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/main/services/settingsService.test.ts`

Expected: FAIL because `SecuritySettings` and the settings service do not yet expose `autoUpdateEnabled`.

- [ ] **Step 3: Add the setting and persistence key**

Add the property at the end of `SecuritySettings`, add `autoUpdateEnabled: true` to `DEFAULT_SETTINGS`, add `autoUpdateEnabled: 'auto_update_enabled'` to `SETTINGS_KEYS`, read it as a strict `'true'` comparison in `getSecuritySettings()`, and persist it with the other booleans in `updateSecuritySettings()`:

```ts
autoUpdateEnabled:
  (getSetting(SETTINGS_KEYS.autoUpdateEnabled) ??
    String(defaults.autoUpdateEnabled)) === 'true',
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx vitest run src/main/services/settingsService.test.ts`

Expected: PASS with both setting tests green.

- [ ] **Step 5: Commit the settings unit**

```bash
git add src/shared/types.ts src/main/services/sessionService.ts src/main/services/settingsService.ts src/main/services/settingsService.test.ts
git commit -m "feat: add automatic update preference"
```

### Task 2: Implement the main-process update service

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/main/services/updateService.ts`
- Create: `src/main/services/updateService.test.ts`

**Interfaces:**
- Produces `UpdateStatus` with `state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'`, `currentVersion`, optional `version`, optional `releaseNotes`, optional `progress`, and optional `error`.
- Produces `initializeUpdateService(): void`, `destroyUpdateService(): void`, `getUpdateStatus(): UpdateStatus`, `setAutoUpdateEnabled(enabled: boolean): void`, `checkForUpdates(manual?: boolean): Promise<UpdateStatus>`, `downloadUpdate(): Promise<UpdateStatus>`, and `installUpdate(): void`.
- Consumes `getSecuritySettings().autoUpdateEnabled` and `electron-updater.autoUpdater`.

- [ ] **Step 1: Add the runtime dependency**

Run `npm install electron-updater`. Confirm `package.json` and `package-lock.json` contain the dependency without changing unrelated versions.

- [ ] **Step 2: Write failing service tests around a mocked updater**

Mock `electron-updater` with an EventEmitter-like `autoUpdater` exposing `checkForUpdates`, `downloadUpdate`, `cancelDownload`, `quitAndInstall`, and mutable `autoDownload`/`autoInstallOnAppQuit`. Cover these cases:

```ts
it('does not initialize network update checks when app is not packaged', ...)
it('rejects prerelease update info and reports not-available', ...)
it('automatically downloads a stable update when the preference is enabled', ...)
it('uses manual download when the preference is disabled', ...)
it('cancels an active background download when automatic updates are disabled', ...)
it('maps download-progress and update-downloaded events to stable status', ...)
```

Use mocked `app.isPackaged = true` and a stable `1.43.0` update fixture for the packaged cases. Assert `autoDownload` is `true` for scheduled checks with the preference enabled, `false` for manual checks while disabled, and `quitAndInstall` is only called by `installUpdate()`.

- [ ] **Step 3: Run the focused test and verify it fails**

Run: `npx vitest run src/main/services/updateService.test.ts`

Expected: FAIL because `updateService.ts` does not exist.

- [ ] **Step 4: Implement the service state machine**

In `initializeUpdateService()`:

1. Return immediately when `!app.isPackaged` or screenshot mode is active.
2. Configure `autoUpdater.setFeedURL({ provider: 'github', owner: 'Tianyu201809', repo: 'pwd-book', private: false })`, `autoInstallOnAppQuit = false`, and event listeners.
3. Set `autoDownload = getSecuritySettings().autoUpdateEnabled`.
4. If enabled, schedule the first `checkForUpdates(false)` after the app window has loaded and repeat every `6 * 60 * 60 * 1000` milliseconds.
5. Broadcast every status change to all live BrowserWindows through the update event channel.

Implement `checkForUpdates(manual)` with a single-flight promise. Set `autoUpdater.autoDownload = !manual && autoUpdateEnabled`; call `autoUpdater.checkForUpdates()`. Normalize only stable SemVer `updateInfo.version` values; any prerelease or malformed version becomes `not-available`. Implement `downloadUpdate()` as the explicit call used when automatic downloading is disabled or failed. Implement `setAutoUpdateEnabled(false)` to clear the timer and call `cancelDownload()` only for an active background download; keep a completed update available for explicit installation.

Map updater events as follows:

```ts
checking-for-update -> { state: 'checking' }
update-available -> { state: 'available', version, releaseNotes }
download-progress -> { state: 'downloading', progress: percent }
update-downloaded -> { state: 'downloaded', version, releaseNotes, progress: 100 }
update-not-available -> { state: 'not-available' }
error -> { state: 'error', error: normalizeUpdateError(error) }
```

Never call `quitAndInstall()` from an updater event; expose it only through `installUpdate()`.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npx vitest run src/main/services/updateService.test.ts`

Expected: PASS for stable-version filtering, automatic/manual download behavior, cancellation, progress, error and install assertions.

- [ ] **Step 6: Commit the update service**

```bash
git add package.json package-lock.json src/main/services/updateService.ts src/main/services/updateService.test.ts
git commit -m "feat: add GitHub release update service"
```

### Task 3: Wire IPC, preload, settings changes, and app lifecycle

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/ipc/handlers.ts:567-588`
- Modify: `src/main/index.ts`
- Modify: `src/preload/api.ts`
- Modify: `src/env.d.ts`

**Interfaces:**
- Adds IPC channels `updateGetStatus`, `updateCheck`, `updateDownload`, `updateInstall` and event `updateStatusChanged`.
- Exposes `getUpdateStatus`, `checkForUpdates`, `downloadUpdate`, `installUpdate`, and `onUpdateStatusChanged(handler)` on `window.electronAPI`.

- [ ] **Step 1: Add shared IPC constants and renderer types**

Add the channel/event constants next to the existing settings constants. Import `UpdateStatus` into preload and environment types. Define the listener signature as `(handler: (status: UpdateStatus) => void) => () => void` so components can unregister listeners.

- [ ] **Step 2: Add main IPC handlers**

Import the service functions into `src/main/ipc/handlers.ts` and register:

```ts
ipcMain.handle(IPC.updateGetStatus, () => getUpdateStatus())
ipcMain.handle(IPC.updateCheck, () => checkForUpdates(true))
ipcMain.handle(IPC.updateDownload, () => downloadUpdate())
ipcMain.handle(IPC.updateInstall, () => installUpdate())
```

Inside the existing `IPC.settingsUpdate` handler, after `const next = updateSecuritySettings(partial)`, call `setAutoUpdateEnabled(next.autoUpdateEnabled)` only when `partial.autoUpdateEnabled !== undefined`; preserve all existing shortcut, browser bridge, and launch-at-login side effects.

- [ ] **Step 3: Expose preload methods and event subscription**

Use the existing `invoke<T>()` helper for the four request methods. For `onUpdateStatusChanged`, register an `ipcRenderer.on(IPC_EVENTS.updateStatusChanged, listener)` and return a remover that calls `ipcRenderer.removeListener` with the same listener.

- [ ] **Step 4: Initialize and destroy with the Electron lifecycle**

Import `initializeUpdateService` and `destroyUpdateService` in `src/main/index.ts`. Call `initializeUpdateService()` after `createWindow()` and the IPC registrations are complete; the service must defer its first check until the main window is loaded. Call `destroyUpdateService()` from the existing `before-quit` cleanup before stopping services. Do not initialize it in screenshot mode.

- [ ] **Step 5: Run typecheck and focused tests**

Run: `npm run typecheck` and `npx vitest run src/main/services/settingsService.test.ts src/main/services/updateService.test.ts`.

Expected: typecheck passes and both focused suites pass.

- [ ] **Step 6: Commit IPC and lifecycle wiring**

```bash
git add src/shared/types.ts src/main/ipc/handlers.ts src/main/index.ts src/preload/api.ts src/env.d.ts
git commit -m "feat: expose update controls through IPC"
```

### Task 4: Build the “版本更新” settings UI

**Files:**
- Modify: `src/components/SettingsView.vue`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `src/i18n/locales/en.ts`

**Interfaces:**
- Consumes `window.electronAPI` update methods and `securitySettings.autoUpdateEnabled`.
- Produces a single settings tab with the current version, automatic-update switch, update state, progress, release notes text, release list link, and explicit restart/install action.

- [ ] **Step 1: Add i18n keys**

Change the visible value of the existing `settings.about` key to “版本更新” / “Version Updates” and add keys for the switch label/description, checking, latest, available version, download progress, downloaded, restart/install, retry, disabled state, and update error. Keep `settings.releaseList` for the existing external link.

- [ ] **Step 2: Add reactive update state and lifecycle cleanup**

In `SettingsView.vue`, add `const updateStatus = ref<UpdateStatus>(...)`, call `getUpdateStatus()` on mount, subscribe with `onUpdateStatusChanged`, and call the returned unsubscribe function from `onBeforeUnmount`. Add:

```ts
async function onAutoUpdateChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ autoUpdateEnabled: enabled })
}

async function checkForUpdates(): Promise<void> {
  updateStatus.value = await window.electronAPI?.checkForUpdates?.() ?? updateStatus.value
}

async function downloadUpdate(): Promise<void> {
  updateStatus.value = await window.electronAPI?.downloadUpdate?.() ?? updateStatus.value
}

function installUpdate(): void {
  window.electronAPI?.installUpdate?.()
}
```

Keep `releaseNotes` rendered with normal Vue text interpolation. Disable buttons while checking/downloading and only show “重启并安装” for `state === 'downloaded'`.

- [ ] **Step 3: Add the switch and status controls under the renamed tab**

Replace the visible `t('settings.about')` heading with the renamed key. Add a `UiSwitch` bound to `securitySettings.autoUpdateEnabled`, a status row for each state, a progress bar driven by `updateStatus.progress`, and buttons using existing `UiButton`/Lucide icon conventions. Keep the existing app description and `openReleaseList()` button in the same card/section.

- [ ] **Step 4: Verify renderer behavior statically**

Run: `npm run typecheck`.

Expected: Vue template, i18n, `Window.electronAPI`, and `SecuritySettings` types compile without errors. Manually run `npm run dev`, open 设置 → 版本更新, toggle the switch, and confirm the setting persists after reopening the view.

- [ ] **Step 5: Commit the settings UI**

```bash
git add src/components/SettingsView.vue src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts
git commit -m "feat: add version update settings UI"
```

### Task 5: Configure electron-builder and GitHub Release assets

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Produces GitHub provider metadata consumed by `electron-updater`.
- Produces Windows NSIS, macOS DMG+ZIP, Linux AppImage, `latest.yml`/`latest-mac.yml`/`latest-linux.yml`, and blockmap files in each Release.

- [ ] **Step 1: Add builder publish configuration and macOS ZIP target**

Add this `build.publish` entry to `package.json`:

```json
"publish": [{
  "provider": "github",
  "owner": "Tianyu201809",
  "repo": "pwd-book",
  "private": false
}]
```

Change the `mac.target` array to include both:

```json
[
  { "target": "dmg", "arch": ["x64", "arm64"] },
  { "target": "zip", "arch": ["x64", "arm64"] }
]
```

Keep the existing DMG artifact name and Windows/Linux targets.

- [ ] **Step 2: Update Windows workflow artifact collection**

Keep the existing Setup.exe ZIP creation, but upload these files from the Windows job so automatic updates receive the raw NSIS installer and metadata:

```yaml
path: |
  release/PwdBook-*-Setup.exe
  release/PwdBook-*-Setup.exe.blockmap
  release/PwdBook-*-Setup.zip
  release/latest.yml
```

- [ ] **Step 3: Update Linux and macOS workflow artifact collection**

Use these paths in the Linux job:

```yaml
path: |
  release/PwdBook-*.AppImage
  release/PwdBook-*.AppImage.blockmap
  release/latest-linux.yml
```

Use these paths in the macOS job:

```yaml
path: |
  release/PwdBook-*.dmg
  release/PwdBook-*.dmg.blockmap
  release/PwdBook-*.zip
  release/PwdBook-*.zip.blockmap
  release/latest-mac.yml
```

Keep `softprops/action-gh-release` with `draft: false`, tag-derived `prerelease`, generated notes, and `files: artifacts/*`.

- [ ] **Step 4: Build locally and inspect generated metadata**

Run: `npm run dist:win:dir` on Windows, then inspect `release` for `latest.yml` and the NSIS blockmap. Run `npm run dist:mac:dir` or `npm run dist:linux` on their native runners in CI; do not attempt cross-platform local builds.

Expected: electron-builder emits the platform metadata alongside the installer artifacts and does not change the current app ID or output directory.

- [ ] **Step 5: Commit packaging changes**

```bash
git add package.json package-lock.json .github/workflows/release.yml
git commit -m "build: publish auto update metadata"
```

### Task 6: Run the complete local verification suite

**Files:**
- Test: all changed TypeScript/Vue files and `src/**/*.test.ts`

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: existing tests plus settings/update service tests pass.

- [ ] **Step 2: Run type checking**

Run: `npm run typecheck`

Expected: `vue-tsc` reports no errors in main, preload, shared, or renderer code.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: ESLint completes without new errors or warnings requiring code changes.

- [ ] **Step 4: Build the application**

Run: `npm run build`

Expected: electron-vite emits main, preload, and all renderer entry points to `out`.

- [ ] **Step 5: Commit any test-only corrections**

If the verification commands expose implementation mistakes, fix the owning task files, rerun the failing command, and commit the correction with a focused message:

```bash
git add src/main/services/updateService.ts src/components/SettingsView.vue
git commit -m "fix: stabilize update verification"
```

### Task 7: Validate a GitHub Release end to end

**Files:**
- Verify: `.github/workflows/release.yml`, GitHub Release assets, packaged application

- [ ] **Step 1: Push a disposable stable test tag**

Create a SemVer tag without a prerelease suffix, such as `v1.42.1`, only after confirming the test version is higher than the installed version. Push it to the `github` remote so the workflow runs.

- [ ] **Step 2: Verify workflow output**

Confirm the Release contains Windows Setup.exe + `latest.yml` + blockmap, Linux AppImage + `latest-linux.yml` + blockmap, and macOS x64/arm64 DMG + ZIP + `latest-mac.yml` + blockmaps. Confirm a prerelease tag produces a GitHub prerelease that the app ignores.

- [ ] **Step 3: Verify packaged application behavior**

Install the previous build on each available native platform. With automatic updates enabled, verify startup finds the stable test Release and begins background download; with the switch disabled, verify startup performs no check. Re-enable the switch, use manual “检查更新”, and verify download requires the explicit action.

- [ ] **Step 4: Verify install safety**

After download completes, confirm the app remains open until “重启并安装” is clicked, then confirm the app exits through normal cleanup and starts at the new version. Verify the local vault remains readable and unchanged.

- [ ] **Step 5: Clean up the test Release**

Delete the disposable GitHub Release and tag after verification so users do not receive the test version.

---

## Plan Self-Review

- **Spec coverage:** settings switch and default are covered by Task 1; updater state and GitHub filtering by Task 2; IPC/lifecycle by Task 3; renamed “版本更新” UI by Task 4; builder metadata and all platform assets by Task 5; automated checks by Task 6; release acceptance and cleanup by Task 7.
- **Placeholder scan:** no `TODO`, `TBD`, vague “handle edge cases”, or undefined implementation step remains; every code change names exact files, interfaces, commands, and expected result.
- **Type consistency:** `UpdateStatus`, `getUpdateStatus`, `checkForUpdates`, `downloadUpdate`, `installUpdate`, and `setAutoUpdateEnabled` are defined in Task 2 and consumed with the same names in Tasks 3 and 4. `autoUpdateEnabled` is introduced in Task 1 before all later consumers.
- **Scope check:** all tasks implement one approved subsystem: GitHub Releases auto-update plus its persisted preference, UI, and release metadata. No vault or unrelated settings refactor is included.
