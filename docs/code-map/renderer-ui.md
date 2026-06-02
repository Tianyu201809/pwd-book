# 渲染进程 UI

渲染进程为纯 Vue 3（Composition API + `<script setup>`），通过 `vaultApi` → `window.electronAPI` 与主进程通信。

## 组件树

```
App.vue
├── TitleBar.vue              # 自定义标题栏、窗口控制
├── LockScreen.vue            # 锁定页状态机
│   └── recovery/*            # 恢复流程子组件
├── VaultView.vue             # 主工作区
│   ├── VaultSidebar.vue      # 分类导航、拖拽排序
│   ├── PasswordList.vue      # 搜索、排序、列表操作
│   └── PasswordDetail.vue    # 条目编辑、图标选择
├── SettingsView.vue          # 设置页 Tab 容器
│   ├── RecoverySettingsPanel.vue
│   └── AppearancePanel.vue
├── CategoryManagePanel.vue   # 分类管理弹窗（VaultSidebar 触发）
├── TagManagePanel.vue        # 标签管理
├── import/ImportDataModal.vue  # 多来源 CSV/JSON 导入向导
├── export/ExportDataModal.vue  # 导出到其他应用 CSV
├── IconPickerModal.vue       # 条目/分类图标选择
├── CategoryIconView.vue      # 彩色图标渲染
└── ToastHost.vue             # 全局 Toast 容器

# 独立渲染入口 quickbar.html → QuickBarApp.vue（置顶快捷搜索，见 [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)）
```

### QuickBarApp.vue

- 无搜索词时展示「最近打开」（`listQuickBarRecent`），最多 5 条，可手动移除。
- 有搜索词时 `filterEntriesBySearch` 过滤；↑↓ / Enter 选择并 `launchEntry`。
- 选中高亮：`.quickbar-result--active`（accent 背景 + 描边）。

### EntryListMenu.vue

列表项右键 / 「⋯」菜单；「移动到」子菜单使用 `position: fixed` 视口定位，分类最多展示 5 条可滚动。

## Composables

### useAppState (`src/composables/useAppState.ts`)

**全局单例状态**（模块级 `ref`），导出供各组件使用。

| 状态/方法 | 说明 |
|-----------|------|
| `screen` | `'lock' \| 'vault' \| 'settings' \| 'email-backup' \| 'password-gen'` |
| `bootstrap()` | 启动：读 vault 状态、设置、分类、侧边栏顺序 |
| `setupVault` / `unlockVault` / `lockVault` | 保险库生命周期 |
| `saveEntry` | 创建/更新条目 + **Toast** 反馈 |
| `loadEntries` / `selectEntry` | 列表与选中项 |
| 分类 | `createCategory`、`reorderSidebarCategories` 等 |
| `exportData` / `importData` | JSON 备份 |
| `previewImportData` / `commitImportData` | 多来源导入预览与提交 |
| `exportDataAsCsv` | 按第三方格式导出 CSV |

错误展示：`parseErrorMessage()`（`shared/utils.ts`）解析 IPC 嵌套错误。

### useAutoLock (`src/composables/useAutoLock.ts`)

监听用户活动（`lastActivityAt`），超时调用 `lockVault()`。

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

- `categoryIcons.ts` — 30+ 图标 id → 颜色/符号映射
- `IconPickerModal.vue` — 搜索过滤、选中回调
- `VaultSidebar.vue` — HTML5 拖拽排序，`reorderSidebarCategories` 持久化
- `CategoryManagePanel.vue` — 新建/删除分类，复用 IconPicker

## 样式

- `assets/styles/tokens.css` — 设计 token（颜色、间距）
- `assets/styles/global.css` — 全局布局、`.vault-texture` 背景

## 类型 re-export

`src/types/index.ts` 从 `@/shared/types` 再导出并扩展 UI 专用类型（如 `ListSortOrder`）。
