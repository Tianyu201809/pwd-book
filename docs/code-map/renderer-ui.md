# 渲染进程 UI

渲染进程为纯 Vue 3（Composition API + `<script setup>`），通过 `vaultApi` → `window.electronAPI` 与主进程通信。

## 组件树

```
App.vue
├── TitleBar.vue              # 自定义标题栏、窗口控制（v1.14.0 详情小窗口置顶；v1.20.0 主窗口置顶；**v1.24.0** 产品学习学士帽）
├── ProductTourHubModal.vue   # 引导中心（**v1.24.0**，6 条路径卡片）
├── ProductTourOverlay.vue    # 引导层：聚光灯/遮罩 + 步骤卡片（**v1.24.0**）
├── LockScreen.vue            # 锁定页状态机
│   └── recovery/*            # 恢复流程子组件
├── VaultView.vue             # 主工作区（v1.14.0：detached 时隐藏内联详情位）
│   ├── PanelEdge.vue         # 面板边缘：4px 分割条 + 圆形折叠钮 + 拖拽调宽（v1.17.0；v1.20.0 常驻分割线、Pointer 调宽）
│   ├── VaultSidebar.vue      # 分类导航、按住拖动排序、分类右键菜单、标签筛选（v1.12.0；v1.14.0 可收缩；v1.17.0 PanelEdge；v1.18.0 pointerdown 立即切换分类）
│   ├── PasswordList.vue      # 搜索、排序、列表操作；**v1.22.0** 列表/方块布局
│   └── PasswordDetail.vue    # 条目编辑、图标选择、TOTP（v1.12.0）；附件与自定义字段（**v1.22.0**）；v1.14.0 弹出小窗口；v1.17.0 PanelEdge
├── SettingsView.vue          # 设置页 Tab 容器（v1.11.0：安全 Tab 含邮箱备份入口；v1.17.0 浏览器扩展安装向导）
│   └── browser/BrowserExtensionGuideModal.vue  # 6 步安装引导 + BrowserExtensionGuideVisual 示意图（v1.17.0）
│   ├── RecoverySettingsPanel.vue
│   └── AppearancePanel.vue
├── EmailBackupView.vue       # 邮箱备份（返回 → 设置 → 安全；v1.13.0 SMTP 密码占位/显隐）
├── SyncHubView.vue           # 同步方式选择（v1.19.0，设置 → 数据 → 同步）
├── FolderSyncView.vue        # 文件夹同步（v1.19.0，Enpass 式目录 + vault.pwdbook）
├── PasswordGenView.vue       # 随机密码（侧栏工具区入口）
├── PasswordHealthView.vue    # 密码健康（v1.12.0，侧栏工具区入口）
├── WifiSyncView.vue          # 局域网同步（v1.9.0，经 Sync Hub 进入；返回 Hub）
│   └── sync/*                # SyncTutorialPanel、SyncPairingQr、SyncTutorialDiagram、SyncConflictModal（v1.12.0；FolderSync 复用 ConflictModal）
├── TagFilterPanel.vue        # 侧栏按标签筛选（v1.12.0，VaultSidebar 内嵌；v1.13.0 搜索框尺寸）
├── CategoryManagePanel.vue   # 分类管理弹窗（VaultSidebar 触发）
├── TagManagePanel.vue        # 标签管理
├── import/ImportDataModal.vue  # 多来源 CSV/JSON 导入向导
├── export/ExportDataModal.vue  # 导出到其他应用 CSV
├── IconPickerModal.vue       # 条目/分类图标选择（图标/字母 Tab、搜索）
├── IconBadge.vue             # 侧栏/设置页彩色图标徽章（v1.11.0）
├── CategoryIconView.vue      # 彩色图标或字母渲染
└── ToastHost.vue             # 全局 Toast 容器

# 独立渲染入口 quickbar.html → QuickBarApp.vue（置顶快捷搜索，见 [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)）
# 独立渲染入口 detail.html → DetailWindowApp.vue（v1.14.0 详情小窗口，见下文）
```

### DetailWindowApp.vue（v1.14.0）

- 第二渲染入口 `detail.html` → `detail.ts`；仅含 `TitleBar`（`detail-window`）、`PasswordDetail`（`detached`）、`ToastHost`。
- `onMounted`：`bootstrap()` + `notifyDetailWindowReady()`；订阅 `detail-window:select-entry` 更新 `selectedEntryId` 并 `refreshVaultData`。
- 订阅 `vault-data:changed` 与主窗口保持数据一致；选中清空且非新建时自动 `closeDetailWindow`。
- 动森皮肤下同样包裹 `Cursor` + `AnimalBackdrop`。

### TitleBar.vue

- 自定义无边框标题栏：换肤、**产品学习**（**v1.24.0**，已解锁时显示学士帽，打开引导中心）、快速锁定（主窗口）、**置顶图钉**（**v1.20.0** 主窗口与详情小窗口均显示；`getWindowAlwaysOnTop` / `toggleWindowAlwaysOnTop`）、最小化 / 最大化 / 关闭。
- **v1.23.0**：经典皮肤 `--titlebar-base` / `--titlebar-accent-wash` / `--titlebar-top-shine` 渐变层（`tokens.css`）；动森皮肤在 `animal-skin.css` 关闭伪元素；最大化时显示叠窗 **还原** SVG，订阅 `window:maximize-changed`。
- `detailWindow` prop 为 true 时：隐藏最大化、快速锁定与产品学习；关闭按钮直接 `closeDetailWindow`；按钮顺序：置顶 → 最小化 → 换肤 → 关闭。
- 主窗口按钮顺序：换肤 → **产品学习**（已解锁）→ 锁定（已解锁时）→ 置顶 → 分隔线 → 最小化 → 最大化 → 关闭。

### QuickBarApp.vue

- 无搜索词时展示「最近打开」（`listQuickBarRecent`），条数由 `quickBarRecentLimit` 决定（默认 5，最大 20；**v1.26.0**），可手动移除。
- 有搜索词时 `filterEntriesBySearch` 过滤（含标题、用户名、网址、备注、分类、标签；v1.12.0 起含 **备注**），上限与最近打开相同（**v1.26.0**）；↑↓ / Enter 经 `launchEntry`：**本地程序**启动，**仅网址**则 `quickBarFocusEntry` 打开主窗口并 `selectEntry`。
- **v1.26.0** 结果区固定 `max-height` 可滚动；↑↓ 时 `scrollIntoView`。
- 选中高亮：`.quickbar-result--active`（accent 背景 + 描边）。
### PanelEdge.vue（v1.17.0；**v1.20.0** 分割线/调宽）

- 侧栏（`placement="after"`）与详情（`placement="before"`）共用的 **4px 边缘**：悬停/收起/调宽时显示 **圆形描边箭头** 折叠钮；分割线在钮位挖空，`z-index` 高于邻列。
- **v1.20.0**：`.panel-edge-sash` 默认 `background: var(--border-default)` 常驻细线；动森皮肤 `animal-skin.css` 覆盖为 2px `--border-strong`，悬停/拖拽仍为 `--accent-primary`；`pointerdown` + `setPointerCapture`；`collapsed` 变化时 `suppressHover` 250ms 避免展开偶发高亮。
- `@toggle` 折叠/展开；非收起态 `@resize-start` 触发面板宽度拖拽（`VaultSidebar` / `PasswordDetail` 监听 `pointermove` / `pointerup` / `pointercancel`）。
- Token：`--panel-edge-width`（`tokens.css`）；动森皮肤下 `.sidebar-shell` / `.detail-shell` 需 `overflow: visible` 避免钮被裁切。

### VaultSidebar.vue

- 自定义分类（非「全部 / 收藏」）支持 **右键菜单**：编辑（`CategoryManagePanel.openEditDialog`）、删除（空分类可删；**v1.25.0** 改用 `UiModal` 二次确认）。
- **按住拖动排序**（v1.17.0）：Pointer 事件 + `TransitionGroup` 实时预览；纵向移动 **≥ `DRAG_ACTIVATION_PX`（15）** 才进入拖拽；边缘 `autoScrollNav`；`reorderSidebarCategories` 持久化；搜索激活时禁用。
- **分类切换**（v1.18.0）：`onItemPointerDown` 在非当前分类上 **立即 `selectCategory`**（先于拖拽阈值判断）；`selectCategory` 将 `selectedEntryId` 置 `null`，右侧详情清空，不再回退列表首条。
- **底部图标栏**（**v1.25.0**）：**工具箱**（随机密码、密码健康）、**管理**（分类/标签）、**回收站**、**设置** 四图标；悬停 tooltip，工具箱/管理弹出子菜单；`CategoryManagePanel` / `TagManagePanel` 无触发按钮挂载于侧栏内。**v1.24.0** / **v1.25.0** 监听 `pwdbook-tour-prepare` 展开对应子菜单。
- **侧栏收缩**（v1.14.0）：右缘 `PanelEdge` 收起至 40px（`pwdbook-sidebar-collapsed`）；`clampSidebarWidth` 在视口不足时自动收起；展开后恢复拖拽调宽（`pwdbook-sidebar-width`）。

> **v1.25.0 前**：「工具与设置」折叠区 + 侧栏内 `TagFilterPanel`（`pwdbook-sidebar-utilities-expanded` / `pwdbook-sidebar-tag-filter-expanded`）— 已移除，标签筛选迁至 `PasswordList.vue`。

### PasswordDetail.vue（内联 / detached）

- 内联模式：左缘 `PanelEdge` 收起/展开（`pwdbook-detail-collapsed`）、拖拽调宽；选中或新建时 `expandDetailPanel`。
- **在新窗口打开**（v1.14.0）：标题栏 `SquareArrowOutUpRight` → `openDetachedDetail`；小窗口打开后主窗口 `detachedDetailOpen` 隐藏 `.vault-detail-slot`。
- `detached` prop：全宽展示、无收起边缘；与小窗口共用编辑/保存/TOTP 等逻辑。
- **附件**（v1.22.0）：`vaultApi.listAttachments` / `addAttachment` 等；只读态可打开/另存为；编辑态可添加/删除。
- **自定义字段**（v1.22.0）：`shared/customFields.ts` 规范化；编辑态增删行；搜索经 `entrySearch.ts` 索引 name/value。

### SettingsView.vue

- 四个 Tab（安全 / 外观 / 数据 / 关于）；Tab 图标使用 `IconBadge`（v1.11.0）。
- **安全** Tab 含 **打开邮箱备份** 按钮（`openEmailBackup`）；`EmailBackupView` 返回时 `navigateTo('settings', 'security')`。
- **v1.26.0** 快捷条开启时展示「快捷条显示条数」下拉（5–20 → `quickBarRecentLimit`）。
- **浏览器扩展安装向导**（v1.17.0）：`BrowserExtensionGuideModal`（6 步、GSAP 动效、`BrowserExtensionGuideVisual`）；`openExtensionsPage` → IPC `shell:open-extensions-page` → `browserLaunchService.openBrowserExtensionsPage`（复制 `chrome://extensions` / `edge://extensions` 到剪贴板）。

### UiInput.vue（`components/ui/`）

- 经典模式（v1.13.0）：`$attrs.class` / `$attrs.style` 绑定在外层 `.ui-input-classic-wrap`，避免 `field-row` 等场景下 flex 宽度只作用于内部 `<input>` 导致布局异常。

### EntryListMenu.vue

列表项右键 / 「⋯」菜单；含 **复制到剪贴板**（`copyEntryData`）、**创建副本**（`duplicateEntry`，标题追加 ` - 副本`）、移动、打开网址/程序等。「移动到」子菜单使用 `position: fixed` 视口定位，分类最多展示 5 条可滚动。

`PasswordList.vue` 在 `@contextmenu` 时调用 `selectEntry`，确保右键与高亮选中一致。**v1.22.0** 工具栏提供列表/方块布局切换（`listLayoutMode` → `localStorage` `pwdbook-entry-list-layout`）。**v1.23.0** 搜索前缀放大镜 `pointer-events: none`，避免遮挡输入框点击。**v1.25.0** 工具栏 **#** 按钮展开 `TagFilterPanel` popover（`list-tag-filter` / `list-tag-filter-panel`）；监听 `TOUR_PREPARE_EVENT` 的 `expand-tag-filter` / `collapse-list-menus`。

## Composables

### useAppState (`src/composables/useAppState.ts`)

**全局单例状态**（模块级 `ref`），导出供各组件使用。

| 状态/方法 | 说明 |
|-----------|------|
| `screen` | `'lock' \| 'vault' \| 'settings' \| 'email-backup' \| 'sync' \| 'wifi-sync' \| 'folder-sync' \| 'password-gen' \| 'password-health' \| 'trash'` |
| `bootstrap()` | 启动：读 vault 状态、设置、分类、侧边栏顺序 |
| `setupVault` / `unlockVault` / `lockVault` | 保险库生命周期；**v1.23.0** `resolveScreenAfterAuth` 在解锁/恢复后消费 `pendingScreenAfterUnlock` |
| `openSettingsFromTray` | **v1.23.0** 托盘「设置」：已解锁 → `settings`；锁定 → 设 pending 并显示锁定页 |
| `focusEntryFromQuickBar` | **v1.26.0** 快捷条网站条目：`navigateTo('vault')` + 清空筛选 + `selectEntry` |
| `saveEntry` | 创建/更新条目 + **Toast** 反馈 |
| `duplicateEntry` | 基于现有条目创建副本（标题追加后缀） |
| `loadEntries` / `selectEntry` | 列表与选中项；`selectEntry` 同步 `detail-window:select-entry`；**v1.18.0** `selectedEntry` 仅在 `selectedEntryId` 有值时解析，切换分类不自动选中首条 |
| `openDetachedDetail` / `detachedDetailOpen` | 弹出详情小窗口；主窗口是否隐藏内联详情位（v1.14.0） |
| `detailCollapsed` / `setDetailCollapsed` / `expandDetailPanel` | 内联详情收起状态（`pwdbook-detail-collapsed`） |
| `handleDetailWindowOpened` / `handleDetailWindowClosed` | 响应小窗口开/关，恢复内联详情展开 |
| `refreshVaultData` | 重载条目；小窗口订阅 `vault-data:changed` |
| 分类 | `createCategory`、`updateCategory`、`deleteCategory`（**v1.25.0** 成功 Toast）、`reorderSidebarCategories` 等 |
| `exportData` / `importData` | PwdBook JSON 备份导入 |
| `previewImportData` / `commitImportData` | 多来源导入（含 PwdBook CSV）预览与提交 |
| `exportDataAsCsv` | PwdBook / 第三方 CSV 导出 |
| `openSync` / `openWifiSync` / `openFolderSync` | Sync Hub 与两种同步页导航（v1.19.0） |
| `loadWifiSyncState` / `loadFolderSyncState` | 同步状态加载 |
| `startWifiSyncServer` / `pullWifiSyncMerge` | Wi-Fi 服务端开关、客户端拉取合并 |
| `pickFolderSyncDirectory` / `connectFolderSync` / `syncFolderNow` | 文件夹选择、连接、手动同步（v1.19.0） |
| `disconnectFolderSync` / `updateFolderSyncAutoSync` | 断开文件夹同步、自动同步开关 |
| `selectedTagFilters` / `toggleTagFilter` / `clearTagFilters` | 标签多选筛选（v1.12.0，AND 逻辑）；**v1.25.0** UI 入口在列表工具栏 |
| `openPasswordHealth` | 密码健康页导航（v1.12.0） |

错误展示：`parseErrorMessage()`（`shared/utils.ts`）解析 IPC 嵌套错误。**v1.18.0** 主进程 `wrap` 与 Preload `invoke` 重抛时附带 `{ cause: error }`，便于 DevTools 追溯。

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

### useProductTour (`src/composables/useProductTour.ts`) — **v1.24.0**

引导状态单例：`openHub` / `startTour` / `nextStep` / `prevStep` / `skipTour`；步骤表来自 `productTourCatalog.ts`；`runStepPrepare` 自动 `navigateTo`、切换设置 Tab、派发 `TOUR_PREPARE_EVENT`；完成路径写入 `localStorage`（`pwdbook-tour-done-{id}`）。详见 [product-tour.md](./product-tour.md)。

## API 门面

```
组件 → useAppState → vaultApi.ts → window.electronAPI → preload/api.ts
```

`vaultApi.ts` 在 `window.electronAPI` 缺失时抛错（非 Electron 环境）。

## 锁定页状态机 (`LockScreen.vue`)

子视图由内部 `recoveryStep` / 模式切换驱动，子组件包括：

| 组件 | 用途 |
|------|------|
| `RecoveryMenu.vue` | 恢复入口菜单（**v1.21.0** 起：恢复密钥 / 清除数据两条路径） |
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
- `VaultSidebar.vue` — 按住拖动排序（v1.17.0）、分类右键菜单，`reorderSidebarCategories` 持久化
- `CategoryManagePanel.vue` — 新建/编辑/删除分类，复用 IconPicker；可由侧栏右键「编辑」唤起

## 样式

- `assets/styles/tokens.css` — 设计 token（颜色、间距）；**v1.17.0** 暗黑色阶上移、`--panel-edge-width`
- `assets/styles/global.css` — 全局布局、`.vault-texture` 背景；**v1.17.0** 暗黑 `.list-item` 背景、`body.category-drag-active` 光标
- `assets/styles/animal-skin.css` — **v1.17.0** 指针 16px、PanelEdge/窄条背景、`overflow: visible`；**v1.20.0** PanelEdge 常驻 2px 分割线与悬停青绿粗线、展开 `suppressHover`
- `assets/styles/product-tour.css` — **v1.24.0** 引导层遮罩、聚光灯、引导卡片与 Hub 弹窗样式

## 类型 re-export

`src/types/index.ts` 从 `@/shared/types` 再导出并扩展 UI 专用类型（如 `ListSortOrder`）。
