# 轻量便签 Implementation Plan

**Goal:** 为 PwdBook 增加加密轻量便签、独立管理窗口和可置顶桌面便签窗口，并纳入备份与同步。

**Architecture:** 新增独立便签领域模型、SQLite 表、服务与 IPC。管理窗口和桌面便签窗口通过 preload typed API 共享同一数据源；标题和版本化块 JSON 使用现有会话密钥加密。窗口显示状态属于设备本地数据，内容实体沿用现有 LWW 同步策略。

**Tech Stack:** Electron 35、Vue 3、TypeScript、sql.js、Vue I18n、Lucide Vue Next、Vitest。

## Global Constraints

- 工具箱入口位于“剪切板”下方，打开唯一管理窗口。
- 首期仅支持文本块、清单块、缩进、便签本、收藏、搜索、颜色和回收站。
- 关闭桌面便签只隐藏；锁定保险库时所有便签窗口隐藏。
- 不将便签字段加入 `password_entries`，不在渲染层落地明文。
- UI 复用当前主题 token，并同时适配经典与动森皮肤。

### Task 1: Shared note contracts and block logic

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/noteBlocks.ts`
- Create: `src/shared/noteBlocks.test.ts`

- [x] 定义便签、便签本、块、输入、筛选和窗口状态类型。
- [x] 添加便签 IPC 常量与窗口事件常量。
- [x] 实现块规范化、创建、拆分、合并、类型切换和缩进纯函数。
- [x] 覆盖损坏输入、长度边界、缩进边界和版本兼容测试。

### Task 2: Database schema and encrypted domain services

**Files:**
- Modify: `src/main/db/database.ts`
- Create: `src/main/services/noteService.ts`
- Create: `src/main/services/noteService.test.ts`

- [x] 创建 `note_books`、`notes` 和必要索引。
- [x] 建立默认便签本，并实现便签本 CRUD 与删除约束。
- [x] 使用现有 vault crypto/session key 加密名称、标题和块 JSON。
- [x] 实现便签 CRUD、搜索、收藏、移动、软删除、恢复和彻底删除。
- [x] 测试加解密、搜索、默认便签本回退和回收站行为。

### Task 3: Typed API, IPC and note window lifecycle

**Files:**
- Modify: `src/preload/api.ts`, `src/preload/index.ts`, `src/env.d.ts`
- Modify: `src/main/ipc/handlers.ts`, `src/main/index.ts`
- Create: `src/main/noteWindows.ts`
- Modify: `electron.vite.config.ts`
- Create: `src/renderer/notes.ts`, `src/renderer/note.ts`
- Create: `src/renderer/notes.html`, `src/renderer/note.html`

- [x] 暴露带类型的便签 API，并在所有 handler 中验证已解锁状态和输入边界。
- [x] 实现唯一管理窗口和按便签 ID 唯一的桌面窗口。
- [x] 保存并校正窗口几何、置顶与可见状态。
- [x] 锁定时隐藏窗口，解锁后恢复本次会话锁定前可见集合。
- [x] 广播实体更新事件，使多个窗口刷新同一份数据。

### Task 4: Tool entry and management window UI

**Files:**
- Modify: `src/components/VaultSidebar.vue`
- Create: `src/components/notes/NotesManagerApp.vue`
- Create: `src/components/notes/NotesSidebar.vue`
- Create: `src/components/notes/NotesList.vue`
- Create: `src/components/notes/NoteEditor.vue`
- Create: `src/components/notes/NoteBlockEditor.vue`
- Create: `src/composables/useNotes.ts`
- Modify: `src/i18n/locales/zh-CN.ts`, `src/i18n/locales/en.ts`

- [x] 在剪切板下增加便签入口并调用管理窗口 API。
- [x] 实现便签本/系统视图、搜索、列表、选择与空状态。
- [x] 实现块编辑、自动保存状态、收藏、颜色、移动、弹出和删除。
- [x] 使用当前 UI 组件、字体、间距、边框和焦点规范。

### Task 5: Desktop sticky note UI

**Files:**
- Create: `src/components/notes/StickyNoteApp.vue`
- Reuse: `src/components/notes/NoteBlockEditor.vue`
- Modify: `src/assets/styles/tokens.css`, `src/assets/styles/animal-skin.css`

- [x] 实现可拖动无边框标题栏、置顶、颜色、隐藏和删除操作。
- [x] 与管理窗口共用块编辑器与自动保存逻辑。
- [x] 提供稳定最小尺寸和响应式编辑区域，避免控件与内容重叠。
- [x] 为经典/动森及明暗模式定义语义便签色 token。

### Task 6: Backup, import and export integration

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/services/exportPayloadService.ts`
- Modify: `src/main/services/importService.ts`
- Modify: `src/main/services/vaultService.ts`
- Update corresponding tests

- [x] 升级导出载荷版本并加入便签本与便签。
- [x] 保持旧载荷可导入，缺少便签字段时按空集合处理。
- [x] 导入时校验、加密并事务写入便签实体。
- [x] 验证新格式往返和旧格式兼容。

### Task 7: Sync integration

**Files:**
- Modify: `src/shared/syncTypes.ts`, `src/shared/syncMerge.ts`
- Modify: `src/main/services/syncBundleService.ts`, `src/main/services/syncMergeService.ts`
- Update: `src/shared/syncMerge.test.ts`

- [x] 在同步包中加入便签本、便签与删除状态，不加入窗口几何和可见状态。
- [x] 沿用实体级 `updatedAt` LWW，处理已删除实体与缺失便签本引用。
- [x] 合并后将悬空便签归入默认便签本。
- [x] 覆盖创建、更新、冲突、删除和旧同步包兼容测试。

### Task 8: Verification and documentation

**Files:**
- Update: `docs/code-map/*` relevant documents

- [ ] 运行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`。
- [ ] 启动应用并检查工具箱入口、管理窗口唯一实例、桌面多窗口和锁定隐藏。
- [ ] 截图检查经典/动森、浅色/深色和紧凑窗口尺寸。
- [ ] 运行 `git diff --check` 并复核仅包含便签功能相关改动。

