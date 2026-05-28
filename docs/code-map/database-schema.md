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
| `security_settings` | JSON：`SecuritySettings` |
| `sidebar_category_order` | JSON：`string[]`，含 `all`、`favorite` 及自定义分类 id |

### 分类数据

自定义分类存于独立逻辑（`categories` 相关表/设置 — 见 `categoryService.ts` 与 `db/categories.ts` 的种子/迁移）。

## 迁移策略

当前采用 **启动时检测 + ALTER**（如 `display_icon`），无独立 migration 版本表。新增列时在 `database.ts` 或专用 migrate 函数中添加 PRAGMA 检测。

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
