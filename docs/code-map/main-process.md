# 主进程

主进程持有数据库连接、加密逻辑与会话密钥，渲染进程通过 IPC 间接访问，**不**直接读写磁盘或解密密码。

## 服务层

### vaultService (`src/main/services/vaultService.ts`)

保险库生命周期与条目 CRUD 的核心。

| 职责 | 说明 |
|------|------|
| `setupVault` | 首次创建：写入 master salt/hash 到 `app_settings` |
| `unlockVault` | 校验主密码 → `deriveSessionKey` → `unlockSession` |
| `lockVault` | `lockSession()`，清除内存密钥 |
| `resetVault` | 删除库文件并重建 |
| 条目 CRUD | 列表/创建/更新/删除/收藏/touch；密码字段加解密 |
| 导入导出 | `importEntries` / 配合 handlers 的 `dataExport` |

解锁后所有条目密码经 `encryptSecret` / `decryptSecret`（`vaultCrypto.ts`）与会话密钥处理。

### sessionService (`src/main/services/sessionService.ts`)

进程内单例，保存 `sessionKey: Buffer | null`。

- `isUnlocked()` — handlers 中 `ensureUnlocked()` 的门禁
- `getSessionKey()` — vaultService 加解密时使用
- **锁定即清零** — 不持久化会话密钥

### recoveryService (`src/main/services/recoveryService.ts`)

恢复密钥（20 位 Base32 风格字符，格式 `XXXX-XXXX-…`）。

| 函数 | 行为 |
|------|------|
| `createRecoveryKey` | 生成密钥；scrypt 存 hash；用恢复密钥 wrap 当前 sessionKey |
| `verifyRecoveryKey` | 锁定态可用，校验格式与 hash |
| `resetMasterPasswordWithRecovery` | 验证恢复密钥 → unwrap sessionKey → 更新主密码 hash → 重新 wrap |
| `regenerateRecoveryKey` | 需主密码 + 已解锁 |
| `clearRecoveryKeyData` | 清除 recovery 相关 settings |

设计细节见 [design/recovery-flow.md](../../design/recovery-flow.md)。

### categoryService (`src/main/services/categoryService.ts`)

- 自定义分类 CRUD、`sort_order`
- `sidebar_category_order` — JSON 数组存于 `app_settings`，含 `all` / `favorite` 伪项
- 删除分类前检查 `entryCount`

### settingsService (`src/main/services/settingsService.ts`)

读写 `SecuritySettings`（**开机自动启动**、自动锁定、剪贴板、关闭行为、快捷条与主窗口全局快捷键、**浏览器自动填充**等），各字段存于 `app_settings` 独立键（见 [database-schema.md](./database-schema.md)）。

### browserBridgeService / browserMatchService / nativeHostRegistryService（v1.6.0）

浏览器扩展经 Native Host 访问保险库，详见 [browser-autofill.md](./browser-autofill.md)。

| 模块 | 职责 |
|------|------|
| `browserBridgeService` | `127.0.0.1` TCP 桥接、`native-bridge.json`、处理 `matchLogins` / `getCredential` |
| `browserMatchService` | 按页面 URL hostname 匹配条目（`urlMatch.ts`） |
| `nativeHostRegistryService` | 设置页一键注册：写 `%APPDATA%\pwd-book\native-host\com.pwdbook.app.json` + Chrome/Edge 注册表 |

生命周期：`main/index.ts` 启动时 `syncBrowserBridge()`；`before-quit` 时 `destroyBrowserBridge()`。

### quickBarRecentService (`src/main/services/quickBarRecentService.ts`)

快捷条「最近打开」专用列表（`quick_bar_recent_ids`），与条目 `last_used_at` 分离。详见 [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)。

### quickBar / mainWindowShortcut

- `src/main/quickBar.ts` — 快捷条窗口与 `Alt+Shift+P` 注册
- `src/main/mainWindowShortcut.ts` — 主窗口 `Alt+Shift+M` 注册，调用 `showFromTray()`

### detailWindow（v1.14.0）

`src/main/detailWindow.ts` — 条目详情独立小窗口。

| 函数 / 行为 | 说明 |
|-------------|------|
| `openDetailWindow(entryId)` | 创建/显示无边框小窗口（默认 480×720，最小 400×520），加载 `detail.html`；须已解锁 |
| `closeDetailWindow` | 关闭小窗口 |
| `hideDetailWindowOnLock` | 锁定时由 handlers 调用，关闭小窗口 |
| `notifyDetailWindowThemeSync` | 主窗口换肤后向小窗口广播 `theme:changed` |
| `registerDetailWindowIpc` | 注册 open/close/ready/select-entry/always-on-top IPC；`vault-data:notify-changed` 广播至其它窗口 |

小窗口 `setAlwaysOnTop` 经 `detail-window:toggle-always-on-top` / `detail-window:get-always-on-top` 暴露（**v1.20.0** 起主窗与小窗统一改用 `window:toggle-always-on-top` / `window:get-always-on-top`，按 sender 窗口操作）。

### autoLock（v1.8.0）

`src/main/autoLock.ts` — 当 `auto_lock_minutes === -1`（跟随系统锁屏）且保险库已解锁时：

1. 监听 `powerMonitor` 的 `lock-screen` 事件
2. 调用 `lockVault()` 清除内存会话密钥
3. 向主窗口发送 `session:system-lock`（`IPC_EVENTS.systemLockScreen`），由渲染进程 `useAutoLock` 切换至锁定页

在 `main/index.ts` 的 `app.whenReady()` 中调用 `registerSystemAutoLock()`。

### launchAtLogin（v1.21.0）

`src/main/launchAtLogin.ts` — 系统登录后自动启动。

| 函数 / 行为 | 说明 |
|-------------|------|
| `syncLaunchAtLogin(enabled)` | 调用 `app.setLoginItemSettings({ openAtLogin: enabled })` |
| 生效条件 | `app.isPackaged` 为真；截图模式（`isScreenshotMode()`）跳过 |
| 触发时机 | `app.whenReady()` 读取 `getSecuritySettings().launchAtLoginEnabled`；`settings:update` 变更该字段时同步 |

设置项：`SecuritySettings.launchAtLoginEnabled`，持久化键 `launch_at_login_enabled`（默认 `false`）。

### 同步服务（v1.9.0 Wi-Fi / v1.19.0 文件夹）

Wi-Fi 详见 [wifi-sync.md](./wifi-sync.md)；文件夹详见 [folder-sync.md](./folder-sync.md)。

| 模块 | 职责 |
|------|------|
| `syncBundleService` | 构建 `SyncBundle`、加密封包、revision / deviceId 状态 |
| `syncMergeService` | 解密远端 bundle → `mergeSyncBundles` → 本地重加密落库 |
| `wifiSyncService` | HTTPS WebDAV Server、mDNS、配对信息、vault 变更 debounce 发布 |
| `syncClientService` | mDNS 发现、pull-merge-push、配对 JSON 同步 |
| `folderSyncService` | **v1.19.0** 用户目录读写 `vault.pwdbook`、连接/断开、解锁与变更时 merge-write |

解锁时：若 `wifi_sync_settings.serverEnabled` → `restoreWifiSyncServerIfNeeded()`；若 `folder_sync_settings.enabled` → `restoreFolderSyncOnUnlock()`。`database.ts` 持久化后调用 `notifyVaultChangedForSync()` 与 `notifyVaultChangedForFolderSync()`。

## 加密模块 (`src/main/crypto/vaultCrypto.ts`)

| 函数 | 算法/说明 |
|------|-----------|
| `hashMasterPassword` / `verifyMasterPassword` | scrypt → 64 字节 hex |
| `deriveSessionKey` | scrypt → 32 字节 AES 密钥 |
| `encryptSecret` / `decryptSecret` | AES-256-GCM；payload = IV(12) + tag(16) + ciphertext |
| `generatePassword` | 本地随机密码生成（UI 调用） |
| `deriveSyncTransportKey` | 跨设备一致的同步传输密钥（v1.9.0） |

### syncBundleCrypto (`src/main/crypto/syncBundleCrypto.ts`)

SyncBundle 整包 AES-256-GCM；魔数 `PBKS`，版本字节 `1`。

## 数据库层 (`src/main/db/`)

### database.ts

- 启动时 `initSqlJs`，WASM 路径：`node_modules/sql.js/dist`
- 建表：`app_settings`、`password_entries`
- `seedAndMigrateCategories` — 默认分类种子与 legacy 迁移
- `migrateEntryDisplayIcon` — 运行时 `ALTER TABLE` 添加 `display_icon`
- 每次写操作后 `persistDatabase()` 刷盘

### helpers.ts

- `getSetting` / `setSetting` — KV 访问
- `readEntryRows` — 查询条目行并映射字段

### categories.ts

内置分类 ID（如 `cat-work`）与迁移逻辑。

## IPC 处理器 (`src/main/ipc/handlers.ts`)

- `wrap()` — 统一 catch 并抛出中文 `Error.message`
- `ensureUnlocked()` — 敏感操作门禁
- `copySecret()` — 写剪贴板 + 可选定时清除（读 `settingsService`）

完整通道列表见 [ipc-and-data-flow.md](./ipc-and-data-flow.md)。

## 主进程窗口 (`src/main/index.ts`)

- 无边框窗口（`frame: false`），配合 `TitleBar.vue`
- `contextIsolation: true`，`nodeIntegration: false`
- 额外 `ipcMain.on`：`window-minimize/maximize/close`、`theme-set-native`
- **v1.20.0** `ipcMain.handle`：`window:get-always-on-top`、`window:toggle-always-on-top`（`BrowserWindow.fromWebContents(event.sender)`）
