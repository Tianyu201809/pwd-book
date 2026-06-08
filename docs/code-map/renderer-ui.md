# 渲染进程 UI

渲染进程为纯 Vue 3（Composition API + `<script setup>`），通过 `vaultApi` → `window.electronAPI` 与主进程通信。

## 组件树

```
App.vue
├── TitleBar.vue              # 自定义标题栏、窗口控制
├── LockScreen.vue            # 锁定页状态机
│   └── recovery/*            # 恢复流程子组件
├── VaultView.vue             # 主工作区
│   ├── VaultSidebar.vue      # 分类导航、拖拽排序、分类右键菜单、标签筛选（v1.12.0）
│   ├── PasswordList.vue      # 搜索、排序、列表操作
│   └── PasswordDetail.vue    # 条目编辑、图标选择、TOTP（v1.12.0）
├── SettingsView.vue          # 设置页 Tab 容器（v1.11.0：安全 Tab 含邮箱备份入口）
│   ├── RecoverySettingsPanel.vue
│   └── AppearancePanel.vue
├── EmailBackupView.vue       # 邮箱备份（返回 → 设置 → 安全）
├── PasswordGenView.vue       # 随机密码（侧栏工具区入口）
├── PasswordHealthView.vue    # 密码健康（v1.12.0，侧栏工具区入口）
├── WifiSyncView.vue          # 局域网同步（v1.9.0，设置 → 数据 → 同步）
│   └── sync/*                # SyncTutorialPanel、SyncPairingQr、SyncTutorialDiagram、SyncConflictModal（v1.12.0）
├── TagFilterPanel.vue        # 侧栏按标签筛选（v1.12.0，VaultSidebar 内嵌）
├── CategoryManagePanel.vue   # 分类管理弹窗（VaultSidebar 触发）
├── TagManagePanel.vue        # 标签管理
├── import/ImportDataModal.vue  # 多来源 CSV/JSON 导入向导
├── export/ExportDataModal.vue  # 导出到其他应用 CSV
├── IconPickerModal.vue       # 条目/分类图标选择（图标/字母 Tab、搜索）
├── IconBadge.vue             # 侧栏/设置页彩色图标徽章（v1.11.0）
├── CategoryIconView.vue      # 彩色图标或字母渲染
└── ToastHost.vue             # 全局 Toast 容器

# 独立渲染入口 quickbar.html → QuickBarApp.vue（置顶快捷搜索，见 [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)）
```

### QuickBarApp.vue

- 无搜索词时展示「最近打开」（`listQuickBarRecent`），最多 5 条，可手动移除。
- 有搜索词时 `filterEntriesBySearch` 过滤（含标题、用户名、网址、备注、分类、标签；v1.12.0 起含 **备注**）；↑↓ / Enter 选择并 `launchEntry`。
- 选中高亮：`.quickbar-result--active`（accent 背景 + 描边）。

### VaultSidebar.vue

- 自定义分类（非「全部 / 收藏」）支持 **右键菜单**：编辑（`CategoryManagePanel.openEditDialog`）、删除（空分类可删，二次确认）。
- HTML5 拖拽排序，`reorderSidebarCategories` 持久化。
- **工具与设置** 折叠区（v1.11.0）：**随机密码**、**密码健康**（v1.12.0）为 `nav-item` + `IconBadge`；底部管理项（分类/标签/回收站/设置/锁定）均使用 `NAV_ICON_STYLES` 彩色徽章。邮箱备份入口已移至 **设置 → 安全**。
- **按标签筛选**（v1.12.0）：分类列表下方独立折叠区，`TagFilterPanel` 提供搜索 + 多选（AND）；`selectedTagFilters` 由 `useAppState` 驱动 `filteredEntries`；展开状态 `pwdbook-sidebar-tag-filter-expanded`。

### SettingsView.vue

- 四个 Tab（安全 / 外观 / 数据 / 关于）；Tab 图标使用 `IconBadge`（v1.11.0）。
- **安全** Tab 含 **打开邮箱备份** 按钮（`openEmailBackup`）；`EmailBackupView` 返回时 `navigateTo('settings', 'security')`。

### EntryListMenu.vue

列表项右键 / 「⋯」菜单；含 **复制到剪贴板**（`copyEntryData`）、**创建副本**（`duplicateEntry`，标题追加 ` - 副本`）、移动、打开网址/程序等。「移动到」子菜单使用 `position: fixed` 视口定位，分类最多展示 5 条可滚动。

`PasswordList.vue` 在 `@contextmenu` 时调用 `selectEntry`，确保右键与高亮选中一致。

## Composables

### useAppState (`src/composables/useAppState.ts`)

**全局单例状态**（模块级 `ref`），导出供各组件使用。

| 状态/方法 | 说明 |
|-----------|------|
| `screen` | `'lock' \| 'vault' \| 'settings' \| 'email-backup' \| 'wifi-sync' \| 'password-gen' \| 'password-health' \| 'trash'` |
| `bootstrap()` | 启动：读 vault 状态、设置、分类、侧边栏顺序 |
| `setupVault` / `unlockVault` / `lockVault` | 保险库生命周期 |
| `saveEntry` | 创建/更新条目 + **Toast** 反馈 |
| `duplicateEntry` | 基于现有条目创建副本（标题追加后缀） |
| `loadEntries` / `selectEntry` | 列表与选中项 |
| 分类 | `createCategory`、`reorderSidebarCategories` 等 |
| `exportData` / `importData` | PwdBook JSON 备份导入 |
| `previewImportData` / `commitImportData` | 多来源导入（含 PwdBook CSV）预览与提交 |
| `exportDataAsCsv` | PwdBook / 第三方 CSV 导出 |
| `openWifiSync` / `loadWifiSyncState` | 同步页导航与状态（v1.9.0） |
| `startWifiSyncServer` / `pullWifiSyncMerge` | 服务端开关、客户端拉取合并 |
| `selectedTagFilters` / `toggleTagFilter` / `clearTagFilters` | 侧栏标签多选筛选（v1.12.0，AND 逻辑） |
| `openPasswordHealth` | 密码健康页导航（v1.12.0） |

错误展示：`parseErrorMessage()`（`shared/utils.ts`）解析 IPC 嵌套错误。

### useAutoLock (`src/composables/useAutoLock.ts`)

两种锁定策略（**设置 → 安全 → 自动锁定**，v1.8.0 起支持 120 分钟与跟随系统锁屏）：

| `autoLockMinutes` | 行为 |
|-------------------|------|
| `> 0` | 在 `vault` / `settings` 屏监听 `lastActivityAt`，超时调用 `lock()` |
| `-1`（`AUTO_LOCK_FOLLOW_SYSTEM`） | 不启空闲计时；订阅主进程 `session:system-lock` 事件，系统锁屏时调用 `lock()` |

空闲计时每秒轮询一次；系统锁屏由主进程 `powerMonitor.on('lock-screen')` 触发（见 [main-process.md](./main-process.md)）。

### useTheme (`src/composables/useTheme.ts`)

明暗模式、主题色 CSS 变量；`setNativeTheme` 同步 Electron `nativeTheme`。

### useToast (`src/composables/useToast.ts`)

轻量 Toast 队列；`ToastHost.vue` 订阅展示。`saveEntry` 成功/失败均调用。

## API 门面

```
组件 → useAppState → vaultApi.ts → window.electronAPI → preload/api.ts
```

`vaultApi.ts` 在 `window.electronAPI` 缺失时抛错（非 Electron 环境）。

## 锁定页状态机 (`LockScreen.vue`)

子视图由内部 `recoveryStep` / 模式切换驱动，子组件包括：

| 组件 | 用途 |
|------|------|
| `RecoveryMenu.vue` | 恢复入口菜单 |
| `RecoveryKeyInput.vue` | 输入恢复密钥 |
| `RecoveryResetPassword.vue` | 设置新主密码 |
| `RecoveryKeySetup.vue` | 首次创建后引导保存恢复密钥 |
| `RecoveryWipe.vue` | 清除保险库确认 |
| `RecoveryTrustNotice.vue` | 安全提示 |
| `RecoveryProgressOverlay.vue` | 异步操作遮罩 |

创建保险库成功后可选进入 `RecoveryKeySetup`；跳过则调用 `recovery:clear`。

## 分类与图标

- `categoryIcons.ts` — **60** 个 Lucide 图形图标 + **26** 个字母图标（`LetterA`–`LetterZ`）；`BASE_CATEGORY_ICON_OPTIONS` / `LETTER_ICON_OPTIONS`；`isLetterIcon()` / `getLetterFromIcon()`
- `navIconStyles.ts` — 侧栏与设置 Tab 的 pastel 徽章配色（v1.11.0）
- `IconPickerModal.vue` — **图标 / 字母** 双 Tab、搜索过滤；动森皮肤下搜索图标走 `UiInput` `#prefix` 插槽
- `IconBadge.vue` — 通用彩色圆角徽章容器
- `CategoryIconView.vue` — 图形图标或字母渲染；字母图标在徽章内显示加粗字符
- `VaultSidebar.vue` — HTML5 拖拽排序、分类右键菜单，`reorderSidebarCategories` 持久化
- `CategoryManagePanel.vue` — 新建/编辑/删除分类，复用 IconPicker；可由侧栏右键「编辑」唤起

## 样式

- `assets/styles/tokens.css` — 设计 token（颜色、间距）
- `assets/styles/global.css` — 全局布局、`.vault-texture` 背景

## 类型 re-export

`src/types/index.ts` 从 `@/shared/types` 再导出并扩展 UI 专用类型（如 `ListSortOrder`）。
