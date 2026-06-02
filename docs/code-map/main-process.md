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

读写 `SecuritySettings`（自动锁定、剪贴板、关闭行为、快捷条与主窗口全局快捷键等），各字段存于 `app_settings` 独立键（见 [database-schema.md](./database-schema.md)）。

### quickBarRecentService (`src/main/services/quickBarRecentService.ts`)

快捷条「最近打开」专用列表（`quick_bar_recent_ids`），与条目 `last_used_at` 分离。详见 [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)。

### quickBar / mainWindowShortcut

- `src/main/quickBar.ts` — 快捷条窗口与 `Alt+Shift+P` 注册
- `src/main/mainWindowShortcut.ts` — 主窗口 `Alt+Shift+M` 注册，调用 `showFromTray()`

## 加密模块 (`src/main/crypto/vaultCrypto.ts`)

| 函数 | 算法/说明 |
|------|-----------|
| `hashMasterPassword` / `verifyMasterPassword` | scrypt → 64 字节 hex |
| `deriveSessionKey` | scrypt → 32 字节 AES 密钥 |
| `encryptSecret` / `decryptSecret` | AES-256-GCM；payload = IV(12) + tag(16) + ciphertext |
| `generatePassword` | 本地随机密码生成（UI 调用） |

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
