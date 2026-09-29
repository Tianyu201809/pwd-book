# GitHub Releases 自动更新设计

**日期：** 2026-09-29  
**状态：** 已确认设计，待实现计划  
**范围：** PwdBook Electron 桌面应用的正式版本自动检查、后台下载和用户确认安装

## 背景

PwdBook 当前使用 Electron + Vue 3，版本号来自 `package.json`，electron-builder 已配置 Windows NSIS、macOS DMG 和 Linux AppImage。GitHub 仓库为 `Tianyu201809/pwd-book`，现有 Release 工作流按 `v*` tag 构建并发布安装资产，但没有向应用提供自动更新所需的 provider 配置和更新元数据。

用户希望以 GitHub Releases 为唯一发布源。应用应在启动后静默检查正式版本，发现新版本后后台下载，下载完成后由用户在设置页确认重启安装；不能在密码库使用过程中强制退出。

## 目标

- 通过 `electron-updater` 使用 GitHub Releases 检查、下载和安装正式版本。
- 仅接受非 Draft、非 Prerelease 且版本号符合 SemVer 的 Release。
- 启动完成后静默检查一次，之后每 6 小时检查一次；设置页可手动检查。
- 将检查、下载进度、失败重试和重启安装全部放在现有设置的“版本更新”栏目中。
- 将用户可见的栏目名称从“关于”改为“版本更新”，保留应用简介、当前版本和 Release 列表入口。
- 支持当前构建平台：Windows x64、macOS x64/arm64、Linux x64 AppImage。
- 更新失败、网络不可用或没有可用资产时不影响当前应用和保险库数据。

## 非目标

- 不在本次范围内增加自建更新服务器、更新代理或账号鉴权。
- 不自动重启、不在下载完成后强制退出、不修改保险库数据库格式。
- 不在本次范围内增加 Windows 代码签名或 macOS 公证；沿用当前未签名发布策略。
- 不追踪 Draft、Prerelease 或不符合 SemVer 的 GitHub Release。

## 方案

采用 `electron-updater`，原因是它已经覆盖 GitHub provider、平台资产选择、更新元数据解析、SHA-512 校验、下载进度和 `quitAndInstall()`，与当前 Electron 主进程边界相符。自行实现 GitHub API 下载会重复处理平台差异和安装器生命周期；静态 manifest 则无法提供应用内后台下载和重启安装。

## 架构

### 主进程更新服务

新增 `src/main/services/updateService.ts`，对 `autoUpdater` 做单一封装，并提供以下职责：

- 仅在 `app.isPackaged` 且非截图模式初始化；开发环境不发起更新网络请求。
- 配置 GitHub provider：`owner: Tianyu201809`、`repo: pwd-book`、`private: false`。
- 设置 `autoDownload = true`，发现正式更新后立即在后台下载；“立即下载”仅作为自动下载失败后的手动重试入口。
- 设置 `autoInstallOnAppQuit = false`，只在用户点击“重启并安装”时调用 `quitAndInstall()`。
- 监听 `checking-for-update`、`update-available`、`update-not-available`、`download-progress`、`update-downloaded` 和 `error`，转换成 renderer 可消费的稳定状态对象。
- 启动后首次检查在主窗口创建并完成加载后触发；后续使用 6 小时定时器。手动检查复用同一请求锁，避免并发检查。
- 仅展示正式版本：对返回版本执行 SemVer 解析，并拒绝 prerelease；provider 返回的 draft 不作为可用更新。
- 通过 `webContents.send` 广播状态，并提供 IPC 查询当前快照、手动检查、开始下载和重启安装。

内部状态包括：`idle`、`checking`、`available`、`downloading`、`downloaded`、`not-available`、`error`。状态可携带当前版本、目标版本、Release notes 纯文本、下载百分比和最近错误代码。远程 Release notes 只作为文本传递，不注入 HTML。

### IPC 与 preload

在 `src/shared/types.ts` 增加更新相关 IPC channel 和事件常量；在 `src/main/ipc/handlers.ts` 注册查询、检查、下载、安装处理器；在 `src/preload/api.ts` 暴露类型化方法和事件订阅；在 `src/env.d.ts` 同步 `Window.electronAPI` 类型。事件监听器必须返回取消函数，供 Vue 组件卸载时清理。

### 设置页

修改 `src/components/SettingsView.vue`：

- 继续使用内部 `SettingsTab = 'about'`，避免无关的导航状态迁移。
- 将该栏目标题、侧栏标签和相关 i18n 文案统一改为“版本更新 / Version Updates”。
- 保留应用名称、当前版本、应用描述和“软件发布列表”外链。
- 增加“检查更新”“立即下载（失败重试）”“重启并安装”等操作及状态反馈。
- 显示更新版本、Release notes 摘要和下载百分比；下载期间允许用户离开该页面，状态由 IPC 快照恢复。
- 对开发版、无可用平台资产或不支持自动更新的情况隐藏安装动作，保留版本信息和 Release 列表入口。

中文和英文文案分别加入 `src/i18n/locales/zh-CN.ts` 与 `src/i18n/locales/en.ts`。

## 发布链路

在 `package.json` 中：

- 增加 `electron-updater` 运行依赖。
- 在 `build.publish` 配置 GitHub provider、owner、repo。
- macOS 保留 DMG，并新增 `zip` target；DMG 用于首次安装，ZIP 用于自动更新。
- 保持 Windows NSIS 和 Linux AppImage target。

更新 `.github/workflows/release.yml`：

- 继续使用 `v*` tag，并将含 `-` 的 tag 发布为 prerelease；应用会忽略这些版本。
- 各平台构建仍在原生 runner 执行，并运行 electron-builder 生成 `latest.yml`、`latest-mac.yml`、`latest-linux.yml`、blockmap 和平台安装包。
- Release 必须发布自动更新所需的原始资产和元数据：Windows NSIS `Setup.exe`、`latest.yml`、对应 blockmap；macOS x64/arm64 ZIP、DMG、`latest-mac.yml` 及 blockmap；Linux AppImage、`latest-linux.yml` 及 blockmap。
- 现有 Windows ZIP 可继续作为手动下载资产，但不能替代 NSIS 原始安装包。
- 发布 job 使用现有 GitHub Actions `contents: write` 权限；不把 token 写入应用或打包产物。

## 数据流与交互

```text
GitHub Release (正式版本 + latest*.yml + 安装资产)
        |
        v
electron-updater (主进程)
        |
        v
updateService 状态机
        |
        +--> IPC 快照/事件 --> preload --> “版本更新”页
        |
        +--> 下载到临时目录 --> 用户点击“重启并安装” --> 正常退出清理 --> 安装器替换版本
```

启动检查和定时检查失败只更新 UI 状态，不阻塞 `createWindow()`、数据库初始化或解锁流程。安装前走现有退出路径，确保托盘、窗口、同步服务和数据库资源释放。

## 错误处理与安全

- GitHub 网络不可用、限流、Release 缺失、资产缺失：显示可读错误，提供重试和打开 Release 列表入口。
- 下载中断：保留当前安装，不覆盖应用目录；用户可重新点击下载。
- 安装阶段异常：不调用退出，应用继续可用。
- 不支持的平台、未打包运行或缺少更新元数据：不发起自动安装，仅展示当前版本和外链。
- 使用 HTTPS GitHub provider、electron-builder 生成的 SHA-512 元数据和安装器校验；本次不新增代码签名。
- Release notes 作为纯文本渲染，避免远程内容进入 `v-html` 或脚本上下文。

## 测试与验收

### 自动化测试

- 更新服务：正式版本过滤、SemVer 比较、状态转换、并发检查锁、错误映射和事件广播。
- IPC/preload：查询、手动检查、下载、安装调用以及监听取消函数。
- 设置页：无更新、发现更新、下载中、已下载、失败和开发环境状态下的文案与按钮行为。
- 运行现有 `npm run typecheck`、`npm run lint`、`npm test`。

### Release 验收

使用一次可删除的正式测试 tag（不含 `-`，并在验证后清理）验证：

1. GitHub Release 产生所有平台安装包和 `latest*.yml`/blockmap。
2. 各平台旧版本能发现新版本并显示目标版本。
3. 点击下载能显示进度，下载完成后不自动退出。
4. 点击“重启并安装”后正常退出并启动新版本。
5. 网络失败、资产缺失和 prerelease 不会阻塞应用或误触发安装。

## 影响范围

- `package.json`、`package-lock.json`：更新依赖、GitHub publish 配置、macOS ZIP target。
- `.github/workflows/release.yml`：发布原始更新资产和元数据。
- `src/main/services/updateService.ts`：新增核心更新服务。
- `src/main/index.ts`、`src/main/ipc/handlers.ts`、`src/shared/types.ts`、`src/preload/api.ts`、`src/env.d.ts`：生命周期、IPC 和类型桥接。
- `src/components/SettingsView.vue`、中英文 i18n：版本更新栏目和交互。
- 新增更新服务及设置页相关测试文件。

不修改保险库、同步、加密和数据库服务。
