# PwdBook Code Map

本目录是 PwdBook 的架构与代码导航文档，供贡献者与 AI 助手快速定位模块职责与数据流。

## 文档索引

| 文档 | 内容 |
|------|------|
| [overview.md](./overview.md) | Executive summary、三层进程模型、技术栈 |
| [main-process.md](./main-process.md) | 主进程：服务层、加密、数据库 |
| [renderer-ui.md](./renderer-ui.md) | 渲染进程：组件树、composables、状态 |
| [ipc-and-data-flow.md](./ipc-and-data-flow.md) | IPC 通道表、解锁/保存/恢复流程图 |
| [database-schema.md](./database-schema.md) | SQLite 表结构与 `app_settings` 键 |
| [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md) | 快捷搜索条、最近打开、全局快捷键与调试 |

## 相关文档

- 产品设计：[design/recovery-flow.md](../../design/recovery-flow.md)
- 用户指南：[README.md](../../README.md)
- 版本日志：[CHANGELOG.md](../../CHANGELOG.md)
- 贡献流程：[CONTRIBUTING.md](../../CONTRIBUTING.md)

## 快速定位

| 我想… | 从这里开始 |
|-------|-------------|
| 改 IPC 或校验逻辑 | `src/main/ipc/handlers.ts` |
| 改加密/主密码 | `src/main/crypto/vaultCrypto.ts`、`vaultService.ts` |
| 改恢复密钥流程 | `recoveryService.ts`、`LockScreen.vue`、`recovery/*` |
| 改 UI 状态与保存 | `useAppState.ts`、`PasswordDetail.vue` |
| 改分类/侧边栏 | `categoryService.ts`、`VaultSidebar.vue` |
| 改快捷条 / 最近打开 / 全局快捷键 | [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md)、`quickBarRecentService.ts`、`QuickBarApp.vue` |
| 改类型定义 | `src/shared/types.ts` |
