# 快捷搜索条与全局快捷键

本文档说明悬浮快捷搜索条（Quick Bar）、「最近打开」列表、全局快捷键的实现与调试要点。

## 模块一览

| 模块 | 路径 | 职责 |
|------|------|------|
| 快捷条窗口 | `src/main/quickBar.ts` | 置顶 BrowserWindow、显示/隐藏、快捷条全局快捷键 |
| 主窗口快捷键 | `src/main/mainWindowShortcut.ts` | 全局快捷键唤起主窗口 |
| 最近打开 | `src/main/services/quickBarRecentService.ts` | 快捷条专用最近列表（与 `last_used_at` 分离） |
| 快捷条 UI | `src/components/QuickBarApp.vue` | 搜索、最近打开、移除；Enter 启动本地程序或定位主窗口网站条目 |
| 样式 | `src/assets/styles/quickbar.css` | 快捷条独立样式（含选中高亮） |
| 渲染入口 | `src/renderer/quickbar.html` + `quickbar.ts` | 独立 Vue 应用 |

设置项定义于 `SecuritySettings`（`src/shared/types.ts`），持久化键见 [database-schema.md](./database-schema.md#快捷条与快捷键)。

## 全局快捷键

| 功能 | 默认快捷键 | 设置键 | 注册函数 |
|------|------------|--------|----------|
| 快捷搜索条 | `Alt+Shift+P` | `quickBarEnabled` | `registerQuickBarShortcut()` |
| 唤起主窗口 | `Alt+Shift+M` | `mainWindowShortcutEnabled` | `registerMainWindowShortcut()` |

- 应用启动时（`src/main/index.ts`）与 **设置更新**（`handlers.ts` → `settings:update`）时重新注册。
- 退出前（`before-quit`）统一 `unregister*`。
- 快捷条锁定时：`showQuickBar()` 会改为 `showFromTray()` 引导解锁。
- 主窗口快捷键：始终 `showFromTray()`（还原最小化、显示并聚焦）。

## 「最近打开」数据模型

快捷条的「最近打开」**不是**主列表按 `last_used_at` 排序的前 5 条，而是独立维护的 ID 列表。

### 存储

- **键**：`app_settings.quick_bar_recent_ids`
- **值**：JSON 字符串数组，最多 5 个条目 id，**顺序即展示顺序**（索引 0 为最近）。

### 写入时机

| 操作 | 函数 | 行为 |
|------|------|------|
| 打开条目（网址/本地程序） | `touchEntry()` → `recordQuickBarRecentEntry()` | 插入队首，去重，截断至 5 |
| 快捷条内手动移除 | `removeQuickBarRecentEntry()` | 从数组删除该 id |
| 首次迁移（无存储键） | `seedQuickBarRecentIfEmpty()` | 从 `last_used_at` 非空条目取前 5 条 id 写入 |

### 读取

`quickbar:list-recent` → `resolveQuickBarRecentEntries(listEntries())`：

1. 若 **从未写入** `quick_bar_recent_ids` → 按 `last_used_at` 种子迁移一次；
2. 若 **已有存储**（含空数组 `[]`）→ 直接使用，**不再**从历史补位；
3. 过滤已删除条目 id，必要时写回 prune 后的列表。

### 与主界面「最近使用」的关系

- 主列表排序字段 `last_used_at` 仍在 `touchEntry` 时更新，**不受**快捷条移除影响。
- 快捷条移除仅改 `quick_bar_recent_ids`，不清除 `last_used_at`。

### 搜索匹配（v1.7.0）

快捷条与主列表共用 `entryMatchesSearch()`（`src/shared/entrySearch.ts`）与 `textMatchesQuery()`（`src/shared/searchMatch.ts`）：

- 字段：标题、用户名、网址、分类名、标签。
- 除原文子串外，纯字母数字查询可匹配中文的**拼音首字母**（依赖 `pinyin-pro`）。
- 主列表搜索高亮仅对原文子串生效（`SearchHighlightText.vue`）。

## 用户可见行为

1. **最多 5 条**最近打开；分类子菜单（主列表右键「移动到」）同样最多展示 5 条，超出滚动。
2. **手动移除**后列表减 1（例如 5→4），**不会**被数据库中其他 `last_used_at` 条目自动补位。
3. **再次打开**任意条目（主窗口或快捷条）后，该条目加入最近打开；满 5 条时挤掉最旧的一项。
4. **全部移除**后列表为空，保持为空，直到用户再次打开条目。

## IPC 与 preload

| 通道 | 类型 | 说明 |
|------|------|------|
| `quickbar:list-recent` | invoke | 返回 `PasswordEntry[]`（已解析顺序） |
| `quickbar:remove-recent` | invoke | 移除 id，返回更新后的列表 |
| `quickbar:hide` / `quickbar:show` | send | 隐藏/显示快捷条 |
| `quickbar:show-main` | send | 显示主窗口（锁定态引导） |
| `quickbar:focus-entry` | send | 显示主窗口并定位到指定条目（网站条目） |
| `quickbar:focus-entry` | 事件（主→渲染） | 主窗口收到后 `navigateTo('vault')` + `selectEntry` |
| `quickbar:resize` | send | 动态高度 |
| `quickbar:shown` | 事件 | 快捷条显示时通知渲染进程刷新 |

`entries:touch` 在更新 `last_used_at` 的同时调用 `recordQuickBarRecentEntry`。

## 调试说明（Systematic Debugging 摘要）

### 问题：移除最近打开后又被填回 5 条

**根因（Phase 1）**：早期实现用 `getRecentOpenedEntries()`（按 `last_used_at` 取前 5）渲染最近列表；移除时清除 `last_used_at`，但库内仍有其他带 `last_used_at` 的条目，下次刷新又凑满 5 条。

**架构修正**：独立 `quick_bar_recent_ids`；移除只改该列表。

**回归（Phase 1）**：改为独立列表后，`seedQuickBarRecentIfEmpty()` 仍用「数组长度为 0」判断，把用户**主动清空**的 `[]` 与**未初始化**混淆，再次触发种子迁移。

**最终修复**：用 `hasQuickBarRecentStore()` 判断 `getSetting('quick_bar_recent_ids') != null`；仅无存储键时才种子迁移。

### 问题：「移动到」子菜单定位/跳动

**根因**：子菜单 `position: absolute; top: 0` 无视口检测；重复 `openMoveSubmenu` 触发两步定位（先重置 `top` 再 `nextTick` 调整）导致鼠标移入时上跳。

**修复**：`position: fixed` + 视口空间计算；已打开时不再重新定位。

### 排查清单

1. 读 `app_settings` 中 `quick_bar_recent_ids` 实际值（`[]` vs 未设置 vs 有 id）。
2. 确认调用链是 `removeQuickBarRecentEntry` 还是误用 `clearEntryLastUsed`（已废弃）。
3. 快捷条刷新：`onQuickBarShown` → `refreshEntries()` → `listQuickBarRecent()`。
4. 全局快捷键冲突：Electron `globalShortcut.register` 返回 false 时静默失败，检查是否与系统/其他应用占用相同 accelerator。

## 相关 UI 文件

- 列表右键菜单定位：`src/components/PasswordList.vue`（`contextMenuRef` + 视口 clamp）
- 「移动到」子菜单：`src/components/EntryListMenu.vue`（fixed 定位、最多 5 项滚动）
- 弹出卡片背景：`--bg-popover`（`global.css` + `animal-skin.css`）
