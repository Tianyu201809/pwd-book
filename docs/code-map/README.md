# PwdBook Code Map

本目录是 PwdBook 的架构与代码导航文档，供贡献者与 AI 助手快速定位模块职责与数据流。

**当前版本：v1.33.0**（`package.json`）— 设置分区（安全 / 剪切板 / 浏览器 / 悬浮条 / 回收站等）；剪切板使用向导与条数上限；产品探索对齐新 UI。

## 文档索引

| 文档 | 内容 |
|------|------|
| [overview.md](./overview.md) | Executive summary、三层进程模型、技术栈 |
| [main-process.md](./main-process.md) | 主进程：服务层、加密、数据库 |
| [renderer-ui.md](./renderer-ui.md) | 渲染进程：组件树、composables、状态 |
| [ipc-and-data-flow.md](./ipc-and-data-flow.md) | IPC 通道表、解锁/保存/恢复流程图 |
| [database-schema.md](./database-schema.md) | SQLite 表结构与 `app_settings` 键 |
| [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md) | 快捷搜索条、最近打开、全局快捷键与调试（**v1.26.0** 条数可配 / 定位主窗口 / 滚动） |
| [clipboard-history.md](./clipboard-history.md) | **v1.32.0** 剪切板历史；**v1.33.0** 独立设置模块、条数上限、使用向导 |
| [browser-autofill.md](./browser-autofill.md) | **v1.6.0** 浏览器扩展、Native Host、桥接协议、注册与安全（**v1.17.0** 安装向导与填充修复；**v1.15.0** 填充条拖拽/收起） |
| [wifi-sync.md](./wifi-sync.md) | **v1.9.0** Wi-Fi 局域网同步、SyncBundle、合并与 IPC |
| [folder-sync.md](./folder-sync.md) | **v1.19.0** 文件夹同步（Enpass 式）、Sync Hub、目录 merge-write |
| [product-tour.md](./product-tour.md) | **v1.24.0** 产品引导；**v1.25.0** 侧栏/列表锚点；**v1.33.0** 对齐新设置分区 |

## 相关文档

- 产品设计：[design/recovery-flow.md](../../design/recovery-flow.md)
- 用户指南：[README.md](../../README.md)
- 版本日志：[CHANGELOG.md](../../CHANGELOG.md)
- 贡献流程：[CONTRIBUTING.md](../../CONTRIBUTING.md)
- Native Host 模板说明：[native-host/README.md](../../native-host/README.md)

## 快速定位

| 我想… | 从这里开始 |
|-------|-------------|
| 改 IPC 或校验逻辑 | `src/main/ipc/handlers.ts` |
| 改加密/主密码 | `src/main/crypto/vaultCrypto.ts`、`vaultService.ts` |
| 改恢复密钥流程 | `recoveryService.ts`、`LockScreen.vue`、`recovery/*` |
| 改 UI 状态与保存 | `useAppState.ts`、`PasswordDetail.vue` |
| 改分类/侧边栏 | `categoryService.ts`、`VaultSidebar.vue` |
| 改图标选择 / 字母图标 / 彩色徽章 | `shared/categoryIcons.ts`、`shared/navIconStyles.ts`、`IconPickerModal.vue`、`IconBadge.vue`、`CategoryIconView.vue` |
| 改预设品牌图标 / 网址匹配 | `shared/presetIcons.ts`、`shared/presetIconAssets.ts`、`src/assets/preset-icons/`、`IconPickerModal.vue`、`PasswordDetail.vue`（**v1.30.0**） |
| 改邮箱备份入口 / 返回导航 | `SettingsView.vue`、`EmailBackupView.vue`、`useAppState.ts`（`openEmailBackup`） |
| 改快捷条 / 最近打开 / 全局快捷键 | [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)、`quickBarRecentService.ts`、`QuickBarApp.vue`、`QuickBarSettingsPanel.vue` |
| 改剪切板历史 / 小窗口 / 系统同步 | [clipboard-history.md](./clipboard-history.md)、`main/clipboardWindow.ts`、`ClipboardWindowApp.vue`、`ClipboardSettingsPanel.vue`、`clipboard/ClipboardGuideModal.vue` |
| 改浏览器填充 / 扩展 / 注册 | [browser-autofill.md](./browser-autofill.md)、`browserBridgeService.ts`、`nativeHostRegistryService.ts`、`extension/` |
| 改浏览器扩展安装向导 | `BrowserSettingsPanel.vue`、`BrowserExtensionGuideModal.vue`、`BrowserExtensionGuideVisual.vue`、`browserLaunchService.ts` |
| 改浏览器填充条 UI（拖拽/收起） | `extension/content.js`、`extension/content.css`（`pwdbook-ui-x` / `pwdbook-ui-y` / `pwdbook-ui-collapsed`） |
| 改面板折叠钮 / 调宽边缘 | `PanelEdge.vue`、`VaultSidebar.vue`、`PasswordDetail.vue`；`--panel-edge-width`（`tokens.css`）；**v1.20.0** 常驻分割线、Pointer Capture 调宽 |
| 改主窗口 / 小窗口置顶 | `TitleBar.vue`；`window:get-always-on-top` / `window:toggle-always-on-top`（`main/index.ts`） |
| 改分类拖拽排序 | `VaultSidebar.vue`（`DRAG_ACTIVATION_PX`、`reorderSidebarCategories`） |
| 改分类切换 / 选中条目逻辑 | `useAppState.ts`（`selectCategory` 清空 `selectedEntryId`；`selectedEntry` 不再回退首条）、`VaultSidebar.vue`（`onItemPointerDown` 立即 `selectCategory`） |
| 改 ESLint / 代码风格 | `eslint.config.mjs`；`npm run lint` / `lint:fix` |
| 改回收站 / 软删除 | `trashService.ts`、`TrashView.vue`、`TrashSettingsPanel.vue`、`VaultSidebar.vue`；`password_entries.deleted_at` |
| 改搜索 / 拼音首字母 | `shared/searchMatch.ts`、`shared/entrySearch.ts`、`SearchHighlightText.vue` |
| 改自动锁定 / 系统锁屏 | `useAutoLock.ts`、`main/autoLock.ts`、`SettingsView.vue`；`AUTO_LOCK_FOLLOW_SYSTEM`（`-1`） |
| 改开机自动启动 | `main/launchAtLogin.ts`、`settingsService.ts`、`SettingsView.vue`；`launch_at_login_enabled`（**v1.21.0**；**v1.23.0** Windows `reg.exe` Run 项加引号、`launch-at-login:available`） |
| 改条目附件 | `attachmentService.ts`、`attachmentSyncService.ts`、`PasswordDetail.vue`；`entry_attachments` 表；`attachments:*` IPC（**v1.22.0**） |
| 改自定义字段 | `shared/customFields.ts`、`PasswordDetail.vue`、`importNormalize.ts`；`password_entries.custom_fields`（**v1.22.0**） |
| 改列表布局 | `PasswordList.vue`、`useAppState.ts`；`pwdbook-entry-list-layout`（**v1.22.0**） |
| 改 TOTP / 密码健康 / 标签筛选 | `shared/totp.ts`、`shared/passwordHealth.ts`、`PasswordDetail.vue`、`PasswordHealthView.vue`、`TagFilterPanel.vue`、`VaultSidebar.vue`、`useAppState.ts` |
| 改邮箱备份 SMTP 密码 UX | `EmailBackupView.vue`（`smtpPasswordModel`、显隐按钮） |
| 改经典输入框布局 | `components/ui/UiInput.vue`（`ui-input-classic-wrap` 承载 class/style） |
| 改详情小窗口 / 置顶 / 主窗同步 | `main/detailWindow.ts`、`DetailWindowApp.vue`、`renderer/detail.ts`、`TitleBar.vue`（`detail-window`）、`useAppState.ts`（`openDetachedDetail`、`detachedDetailOpen`）；**v1.20.0** 主窗亦用 `getWindowAlwaysOnTop` |
| 改侧栏收缩 | `VaultSidebar.vue`（`pwdbook-sidebar-collapsed`） |
| 改 Wi-Fi 同步 / 合并 | [wifi-sync.md](./wifi-sync.md)、`wifiSyncService.ts`、`syncMergeService.ts`、`shared/syncMerge.ts` |
| 改文件夹同步 / Sync Hub | [folder-sync.md](./folder-sync.md)、`folderSyncService.ts`、`SyncHubView.vue`、`FolderSyncView.vue` |
| 改 Wi-Fi 同步冲突 UI | `WifiSyncView.vue`、`FolderSyncView.vue`、`sync/SyncConflictModal.vue`、`shared/syncMerge.ts` |
| 改托盘文案 / 语言 | `shared/trayLabels.ts`、`main/tray.ts`；`app_settings.ui_locale` |
| 改托盘打开设置 | `main/tray.ts`（`openSettingsFromTray`）、`useAppState.ts`（`openSettingsFromTray`、`pendingScreenAfterUnlock`）、`App.vue`；`tray:open-settings`（**v1.23.0**） |
| 改数据库损坏隔离 | `main/db/database.ts`（`isValidSqliteFile`、`quarantineCorruptDatabaseFile`）、`main/index.ts` 启动弹窗（**v1.23.0**） |
| 改标题栏 / 最大化按钮 | `TitleBar.vue`、`tokens.css`（`--titlebar-*`）；`window:get-maximized` / `window:maximize-changed`（**v1.23.0**） |
| 改产品引导 / 引导中心 | [product-tour.md](./product-tour.md)、`useProductTour.ts`、`productTourCatalog.ts`、`ProductTourOverlay.vue`、`ProductTourHubModal.vue`；各组件 `data-tour` 锚点 |
| 改类型定义 | `src/shared/types.ts`、`src/shared/syncTypes.ts`、`src/shared/browserBridgeProtocol.ts` |
