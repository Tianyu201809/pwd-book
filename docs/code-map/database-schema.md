# 数据库结构

数据库文件：`{userData}/pwdbook.db`（sql.js 内存库 + `persistDatabase()` 刷盘）。

初始化：`src/main/db/database.ts` → `initDatabase()`。

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
| `last_used_at` | INTEGER | Unix ms，可空 |
| `created_at` | INTEGER | Unix ms |
| `updated_at` | INTEGER | Unix ms |

应用层类型：`PasswordEntry`（`shared/types.ts`），列表/详情中 `password` 为解密后的明文。

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
| `auto_lock_minutes` | 自动锁定分钟数 |
| `clipboard_clear_enabled` | 剪贴板定时清除 |
| `clipboard_clear_seconds` | 清除延迟秒数 |
| `close_window_action` | `ask` / `tray` / `quit` |
| `open_url_with_credentials` | 打开网址是否附带 user/pwd |
| `quick_bar_enabled` | 快捷搜索条开关 |
| `quick_bar_accelerator` | 快捷条快捷键，默认 `Alt+Shift+P` |
| `main_window_shortcut_enabled` | 主窗口全局快捷键开关 |
| `main_window_shortcut_accelerator` | 主窗口快捷键，默认 `Alt+Shift+M` |
| `browser_fill_enabled` | 浏览器自动填充桥接开关（v1.6.0） |
| `browser_extension_id` | 上次注册的 Chrome 扩展 ID（32 位 a–p） |
| `sidebar_category_order` | JSON：`string[]`，含 `all`、`favorite` 及自定义分类 id |

### 快捷条与快捷键

| Key | 说明 |
|-----|------|
| `quick_bar_recent_ids` | JSON：`string[]`，快捷条「最近打开」条目 id，最多 5；**空数组表示用户已清空**，不会自动从历史补位 |

### 分类数据

自定义分类存于独立逻辑（`categories` 相关表/设置 — 见 `categoryService.ts` 与 `db/categories.ts` 的种子/迁移）。

## 迁移策略

当前采用 **启动时检测 + ALTER**（如 `display_icon`），无独立 migration 版本表。新增列时在 `database.ts` 或专用 migrate 函数中添加 PRAGMA 检测。

## 浏览器桥接运行时文件（非 SQLite）

| 路径 | 说明 |
|------|------|
| `{userData}/native-bridge.json` | Bridge 监听端口与 `token`（`browserFillEnabled` 时生成） |
| `{userData}/native-host/com.pwdbook.app.json` | Chrome Native Messaging 清单（设置页注册后） |

详见 [browser-autofill.md](./browser-autofill.md)。

## 备份 JSON 结构

`ExportPayload`（`data:export`）：

```json
{
  "exportedAt": "ISO-8601",
  "categories": [ /* VaultCategory[] */ ],
  "entries": [ /* PasswordEntry[] 含明文 password */ ]
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
