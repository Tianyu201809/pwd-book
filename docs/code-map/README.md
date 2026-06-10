# PwdBook Code Map

本目录是 PwdBook 的架构与代码导航文档，供贡献者与 AI 助手快速定位模块职责与数据流。

**当前版本：v1.17.0**（`package.json`）— 浏览器扩展安装向导、PanelEdge 面板折叠钮、分类按住拖动排序等。

## 文档索引

| 文档 | 内容 |
|------|------|
| [overview.md](./overview.md) | Executive summary、三层进程模型、技术栈 |
| [main-process.md](./main-process.md) | 主进程：服务层、加密、数据库 |
| [renderer-ui.md](./renderer-ui.md) | 渲染进程：组件树、composables、状态 |
| [ipc-and-data-flow.md](./ipc-and-data-flow.md) | IPC 通道表、解锁/保存/恢复流程图 |
| [database-schema.md](./database-schema.md) | SQLite 表结构与 `app_settings` 键 |
| [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md) | 快捷搜索条、最近打开、全局快捷键与调试 |
| [browser-autofill.md](./browser-autofill.md) | **v1.6.0** 浏览器扩展、Native Host、桥接协议、注册与安全（**v1.17.0** 安装向导与填充修复；**v1.15.0** 填充条拖拽/收起） |
| [wifi-sync.md](./wifi-sync.md) | **v1.9.0** Wi-Fi 局域网同步、SyncBundle、合并与 IPC |

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
| 改邮箱备份入口 / 返回导航 | `SettingsView.vue`、`EmailBackupView.vue`、`useAppState.ts`（`openEmailBackup`） |
| 改快捷条 / 最近打开 / 全局快捷键 | [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)、`quickBarRecentService.ts`、`QuickBarApp.vue` |
| 改浏览器填充 / 扩展 / 注册 | [browser-autofill.md](./browser-autofill.md)、`browserBridgeService.ts`、`nativeHostRegistryService.ts`、`extension/` |
| 改浏览器扩展安装向导 | `BrowserExtensionGuideModal.vue`、`BrowserExtensionGuideVisual.vue`、`SettingsView.vue`、`browserLaunchService.ts` |
| 改浏览器填充条 UI（拖拽/收起） | `extension/content.js`、`extension/content.css`（`pwdbook-ui-x` / `pwdbook-ui-y` / `pwdbook-ui-collapsed`） |
| 改面板折叠钮 / 调宽边缘 | `PanelEdge.vue`、`VaultSidebar.vue`、`PasswordDetail.vue`；`--panel-edge-width`（`tokens.css`） |
| 改分类拖拽排序 | `VaultSidebar.vue`（`DRAG_ACTIVATION_PX`、`reorderSidebarCategories`） |
| 改回收站 / 软删除 | `trashService.ts`、`TrashView.vue`、`VaultSidebar.vue`；`password_entries.deleted_at` |
| 改搜索 / 拼音首字母 | `shared/searchMatch.ts`、`shared/entrySearch.ts`、`SearchHighlightText.vue` |
| 改自动锁定 / 系统锁屏 | `useAutoLock.ts`、`main/autoLock.ts`、`SettingsView.vue`；`AUTO_LOCK_FOLLOW_SYSTEM`（`-1`） |
| 改 TOTP / 密码健康 / 标签筛选 | `shared/totp.ts`、`shared/passwordHealth.ts`、`PasswordDetail.vue`、`PasswordHealthView.vue`、`TagFilterPanel.vue`、`VaultSidebar.vue`、`useAppState.ts` |
| 改邮箱备份 SMTP 密码 UX | `EmailBackupView.vue`（`smtpPasswordModel`、显隐按钮） |
| 改经典输入框布局 | `components/ui/UiInput.vue`（`ui-input-classic-wrap` 承载 class/style） |
| 改详情小窗口 / 置顶 / 主窗同步 | `main/detailWindow.ts`、`DetailWindowApp.vue`、`renderer/detail.ts`、`TitleBar.vue`（`detail-window`）、`useAppState.ts`（`openDetachedDetail`、`detachedDetailOpen`） |
| 改侧栏收缩 | `VaultSidebar.vue`（`pwdbook-sidebar-collapsed`） |
| 改 Wi-Fi 同步 / 合并 | [wifi-sync.md](./wifi-sync.md)、`wifiSyncService.ts`、`syncMergeService.ts`、`shared/syncMerge.ts` |
| 改 Wi-Fi 同步冲突 UI | `WifiSyncView.vue`、`sync/SyncConflictModal.vue`、`shared/syncMerge.ts` |
| 改托盘文案 / 语言 | `shared/trayLabels.ts`、`main/tray.ts`；`app_settings.ui_locale` |
| 改类型定义 | `src/shared/types.ts`、`src/shared/syncTypes.ts`、`src/shared/browserBridgeProtocol.ts` |
