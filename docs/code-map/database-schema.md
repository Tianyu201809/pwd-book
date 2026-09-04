# 数据库结构

数据库文件：`{userData}/pwdbook.db`（sql.js 内存库 + `persistDatabase()` 刷盘）。

初始化：`src/main/db/database.ts` → `initDatabase()`。

**损坏文件隔离（v1.23.0）**：若磁盘上的 `pwdbook.db` 缺少 SQLite 魔数，启动时重命名为同目录 `pwdbook.db.corrupt-{timestamp}` 并创建新空库；原文件保留供手动恢复。初始化抛错时主进程弹窗后退出，避免无响应卡死。

## 表：password_entries

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `title` | TEXT | 必填 |
| `url` | TEXT | 默认 `''` |
| `username` | TEXT | 默认 `''` |
| `password_encrypted` | TEXT | AES-256-GCM base64 |
| `note` | TEXT | 默认 `''` |
| `category` | TEXT | 分类 id，默认 `cat-work` |
| `tags` | TEXT | JSON 数组字符串 |
| `is_favorite` | INTEGER | 0/1 |
| `display_icon` | TEXT | 条目图标 id（迁移添加） |
| `local_program_path` | TEXT | 本地程序路径（迁移添加） |
| `totp_secret_encrypted` | TEXT | TOTP Base32 密钥 AES-256-GCM base64（v1.12.0 迁移添加） |
| `custom_fields` | TEXT | JSON 数组 `EntryCustomField[]`（v1.22.0 迁移添加，默认 `[]`） |
| `last_used_at` | INTEGER | Unix ms，可空 |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |
| `deleted_at` | INTEGER | Unix ms，可空；**非空表示在回收站**（v1.7.0 迁移添加） |

应用层类型：`PasswordEntry`（`shared/types.ts`），列表/详情中 `password` 为解密后的明文。`deleted_at IS NULL` 为活跃条目；回收站列表见 `TrashedEntry`（含 `deletedAt`、`expiresAt`、`daysRemaining`）。

**软删除（v1.7.0）**：删除条目写入 `deleted_at`；还原清空该列；彻底删除或超保留期则 `DELETE` 行。活跃列表、分类计数、浏览器填充等查询均过滤 `deleted_at IS NULL`。

## 表：entry_attachments（v1.22.0）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `entry_id` | TEXT | 关联 `password_entries.id` |
| `filename` | TEXT | 原始文件名 |
| `mime_type` | TEXT | MIME，默认 `application/octet-stream` |
| `size_bytes` | INTEGER | 原始字节大小 |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |

文件内容 AES 加密存于 `{userData}/attachments/{id}.enc`，不入 SQLite BLOB。

## 表：app_settings

键值存储，见 `db/helpers.ts`。

### 主密码

| Key | 说明 |
|-----|------|
| `master_salt` | 16 字节 hex |
| `master_hash` | scrypt 输出 hex |

### 恢复密钥

| Key | 说明 |
|-----|------|
| `recovery_salt` | 恢复密钥 scrypt salt |
| `recovery_hash` | 恢复密钥 scrypt hash |
| `recovery_wrap_salt` | wrap 用 salt |
| `recovery_wrap` | 经恢复密钥加密的 sessionKey 包装 |

### 应用设置

| Key | 说明 |
|-----|------|
| `auto_lock_minutes` | 自动锁定分钟数；正整数为空闲锁定分钟；`-1` 表示跟随系统锁屏（v1.8.0，`AUTO_LOCK_FOLLOW_SYSTEM`） |
| `launch_at_login_enabled` | 开机自动启动（v1.21.0）；`true` / `false`，默认 `false` |
| `clipboard_clear_enabled` | 剪贴板定时清除 |
| `clipboard_clear_seconds` | 清除延迟秒数 |
| `clipboard_enabled` | 剪切板历史系统监听（v1.32.0，默认 `false`） |
| `clipboard_default_expiry` | 新记录默认过期秒数：`30` / `300` / `900` / `1800` / `0`（v1.32.0，默认 `300`） |
| `clipboard_persistence` | 重启后保留剪切板历史（v1.32.0，默认 `false`） |
| `close_window_action` | `ask` / `tray` / `quit` |
| `trash_retention_days` | 回收站保留天数，默认 `30`（v1.7.0） |
| `quick_bar_enabled` | 快捷搜索条开关 |
| `quick_bar_accelerator` | 快捷条快捷键，默认 `Alt+Shift+P` |
| `quick_bar_recent_limit` | 快捷条最近打开/搜索结果条数（5–20，默认 5；**v1.26.0**） |
| `main_window_shortcut_enabled` | 主窗口全局快捷键开关 |
| `main_window_shortcut_accelerator` | 主窗口快捷键，默认 `Alt+Shift+M` |
| `browser_fill_enabled` | 浏览器自动填充桥接开关（v1.6.0） |
| `attachment_deletion_tombstones` | JSON：`Record<attachmentId, deletedAt>`，同步删除合并用（v1.22.0） |
| `browser_extension_id` | 上次注册的 Chrome 扩展 ID（32 位 a–p） |
| `sidebar_category_order` | JSON：`string[]`，含 `all`、`favorite` 及自定义分类 id |
| `wifi_sync_settings` | JSON：`serverEnabled`、`accessPassword`、`port`、`pairedDevices`（v1.9.0） |
| `folder_sync_settings` | JSON：`enabled`、`folderPath`、`autoSync`（v1.19.0） |
| `sync_device_id` | 本机同步设备 UUID（v1.9.0） |
| `sync_revision` | 当前 SyncBundle 版本号（v1.9.0） |
| `sync_last_synced_at` | 上次成功同步时间戳 ms（v1.9.0） |
| `sync_last_sync_error` | 最近一次同步错误信息（v1.9.0） |
| `ui_locale` | 界面语言 `zh-CN` / `en`；托盘菜单文案同步（v1.12.0） |

### 快捷条与快捷键

| Key | 说明 |
|-----|------|
| `quick_bar_recent_ids` | JSON：`string[]`，快捷条「最近打开」条目 id，最多 `quick_bar_recent_limit`（默认 5，最大 20）；**空数组表示用户已清空**，不会自动从历史补位 |
| `quick_bar_recent_limit` | 快捷条最近打开/搜索结果一次展示条数（5–20，默认 5） |

### 分类数据

自定义分类存于独立逻辑（`categories` 相关表/设置 — 见 `categoryService.ts` 与 `db/categories.ts` 的种子/迁移）。

## 迁移策略

当前采用 **启动时检测 + ALTER**（如 `display_icon`），无独立 migration 版本表。新增列时在 `database.ts` 或专用 migrate 函数中添加 PRAGMA 检测。

## 浏览器桥接运行时文件（非 SQLite）

| 路径 | 说明 |
|------|------|
| `{userData}/pwdbook.db` | 主 SQLite 库（sql.js 内存 + 刷盘） |
| `{userData}/pwdbook.db.corrupt-*` | 损坏库备份（v1.23.0 自动隔离） |
| `{userData}/attachments/{id}.enc` | 条目附件密文（v1.22.0） |
| `{userData}/native-bridge.json` | Bridge 监听端口与 `token`（`browserFillEnabled` 时生成） |
| `{userData}/native-host/com.pwdbook.app.json` | Chrome Native Messaging 清单（设置页注册后） |

详见 [browser-autofill.md](./browser-autofill.md)。

## Wi-Fi 同步运行时文件（v1.9.0，非 SQLite）

| 路径 | 说明 |
|------|------|
| `{userData}/sync-server/vault.pwdbook` | Server 对外加密 SyncBundle |
| `{userData}/sync-server/attachments/*.pwdattach` | Wi-Fi 同步附件密文（v1.22.0） |
| `{userData}/wifi-sync-certs/` | 自签 TLS 证书与私钥 |

详见 [wifi-sync.md](./wifi-sync.md)。

## 文件夹同步（v1.19.0，非 SQLite）

| 路径 | 说明 |
|------|------|
| `{用户选择的目录}/vault.pwdbook` | 加密 SyncBundle；由 `folderSyncService` 读写 |
| `{用户选择的目录}/attachments/*.pwdattach` | 文件夹同步附件密文（v1.22.0） |

详见 [folder-sync.md](./folder-sync.md)。

## 备份 JSON 结构

`ExportPayload`（`data:export`），**v1.22.0** 起 `version: 2`：

```json
{
  "version": 2,
  "exportedAt": "ISO-8601",
  "categories": [ /* VaultCategory[] */ ],
  "entries": [ /* PasswordEntry[] 含明文 password、customFields */ ],
  "attachments": [ /* ExportAttachment[]，含 dataBase64 */ ]
}
```

导出需在**已解锁**状态；文件含敏感信息，应离线妥善保管。

### Excel 导出（`data:export-excel`）

- 工作簿含 **密码条目**、**分类** 两个工作表，字段与 `ExportPayload` 对应。
- 仅用于人工查看；**不可用于导入**（导入请用 JSON 或 PwdBook CSV）。

### 邮件备份 ZIP

AES-256 密码 ZIP（主密码解压）内包含同日期前缀的文件：

- `pwdbook-backup-YYYY-MM-DD.json` — 可导入（亦可用导出的 PwdBook CSV）
- `pwdbook-backup-YYYY-MM-DD.xlsx` — 只读副本
