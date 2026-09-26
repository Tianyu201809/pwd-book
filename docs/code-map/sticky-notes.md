# 轻量便签（管理窗 / 桌面窗）

**v1.38.0** 在保险库中增加加密便签：独立管理窗口、可置顶桌面窗、单层便签本、文本/待办块、颜色、收藏与回收站。便签走会话密钥 AES，纳入备份与同步；窗口几何和桌面可见性只留本机。**v1.39.0** 增加管理窗全局快捷键，并在 **设置 → 便签** 开关。**v1.40.0** 支持管理窗分栏调宽与列表右键移动便签到其他便签本。**v1.41.0** 可把当前便签复制为纯文本。**v1.42.0** 修复回收站预览操作按钮在窄宽度下的换行布局。**v1.43.0** 管理窗快捷键可录制更换，桌面窗可最小化到任务栏，右键便签本可在该本中新建便签；托盘菜单可打开便签。

## 模块一览

| 模块 | 路径 | 职责 |
|------|------|------|
| 窗口 | `src/main/noteWindows.ts` | 唯一管理窗、每条便签最多一个桌面窗、锁定隐藏、解锁恢复 |
| 服务 | `src/main/services/noteService.ts` | 便签/便签本 CRUD、加解密、搜索、软删除、导入导出、同步实体 |
| 块逻辑 | `src/shared/noteBlocks.ts` | schema、规范化、拆合、缩进、类型切换、`- `/`[] ` 前缀、**v1.41.0** `formatNotePlainText` |
| 复制 | `src/components/notes/copyNoteText.ts` | **v1.41.0** 写入系统剪切板；`clearAfterMs: 0`，不按密码策略自动清空 |
| 管理 UI | `src/components/notes/NotesManagerApp.vue` | 筛选、便签本、列表、分栏调宽、右键移动、**v1.41.0** 右键复制、**v1.42.0** 回收站预览按钮自适应布局、**v1.43.0** 便签本右键新建、重命名/删除弹窗 |
| 编辑器 | `NoteEditor.vue`、`NoteBlockEditor.vue` | 自动保存、草稿保护、只读便签本名称、标题/块导航、**v1.41.0** 工具栏复制 |
| 桌面 UI | `src/components/notes/StickyNoteApp.vue` | 无边框纸张窗、置顶、颜色、隐藏、删除、**v1.41.0** 标题栏复制、**v1.43.0** 标题栏最小化 |
| 状态 | `src/composables/useNotes.ts` | 管理窗列表与筛选；**v1.43.0** `createNote(bookId)` 可指定便签本 |
| 入口 | `VaultSidebar.vue`、`tray.ts` | 工具箱「便签」（剪切板下方，**v1.43.0** 不再显示快捷键提示）；托盘「打开便签」 |
| 设置 | `NotesSettingsPanel.vue`、`ShortcutRecorder.vue` | **v1.39.0** 快捷键开关；**v1.43.0** 录制更换组合键 |
| 渲染入口 | `src/renderer/notes.{html,ts}`、`note.{html,ts}` | 独立 Vue 应用 |

IPC 常量见 `src/shared/types.ts`，通道表见 [ipc-and-data-flow.md](./ipc-and-data-flow.md#便签)。表结构见 [database-schema.md](./database-schema.md#表note_books--notes)。

## 窗口行为

| 行为 | 说明 |
|------|------|
| 管理窗 | 默认 1080×720，最小 820×560；重复打开聚焦已有实例 |
| 管理窗分栏 | **v1.40.0** 便签本、列表与编辑区之间的两处分隔条可拖拽或用方向键调整；宽度保存在本机 `localStorage`，缩窄窗口时保留编辑区最小宽度 |
| 全局快捷键 | **v1.39.0** 默认 `Alt+Shift+N`（`notes_manager_accelerator`）；**v1.43.0** 可在设置中录制更换，规则见 [quickbar-and-shortcuts.md](./quickbar-and-shortcuts.md#全局快捷键)。`notesManagerShortcutEnabled` 控制注册；已显示再按一次收起；锁定时 `showFromTray()` |
| 托盘 | **v1.43.0** 「打开便签」调用 `openNotesManager()`；未解锁则 `showFromTray()` |
| 桌面窗 | 默认约 360×420，最小 280×240；坐标校正到当前显示器工作区 |
| 最小化桌面窗 | **v1.43.0** 标题栏最小化先 `flush`，再 `window-minimize`。非主窗口走 `win.minimize()`，收到任务栏。已最小化的窗再次打开会 `restore()` 后聚焦。锁定时把 `isVisible() \|\| isMinimized()` 视为仍打开，解锁后恢复 |
| 关闭桌面窗 | 只隐藏（`is_desktop_visible = 0`），不删除 |
| 置顶 | 按便签保存 `is_always_on_top` |
| 锁定 | 先 `notes:flush`，再隐藏管理窗与桌面窗，然后清会话密钥 |
| 解锁 | 恢复本次锁定前可见集合；本会话首次解锁按 `is_desktop_visible` 恢复 |
| 未解锁 | 拒绝打开管理窗 / 桌面窗 |

## 编辑器

- 停输约 400ms 自动保存；失焦、关窗、锁定前 `flush`。
- **v1.40.0** 工具栏只显示当前便签本名称；在列表条目上右键，通过「移动到便签本」子菜单移动。移动前等待未保存草稿写入，保存失败时不执行移动；回收站不提供移动入口。
- **v1.41.0** 复制当前便签全部内容：标题后空一行，再逐段输出正文；待办写成 `[ ] ` / `[x] `，缩进为每级两个空格，末尾空段去掉。列表右键、编辑工具栏（窄宽度收成图标）、回收站预览和桌面窗标题栏都可触发。正在编辑的那条复制草稿；内容损坏时按钮禁用。成功后 Toast「已复制全部内容」。
- **v1.42.0** 回收站预览底部操作区允许按钮自动换行；按钮文字保持单行，避免窄编辑区中复制、恢复、彻底删除被压缩成逐字竖排。
- **v1.43.0** 便签本右键菜单第一项是「新建便签」（含默认本 `notes-default`）。`createNote(bookId)` 会把筛选切到该本再刷新并选中新便签。重命名和删除仍不出现在默认本上。
- 有本地未保存修改时，较旧的 `notes:changed` 不会覆盖草稿。
- 底栏分段开关转换**当前焦点段**；待办行只显示勾选框。
- `Ctrl+Enter` / `Cmd+Enter` 切换当前段类型。
- 空待办行首退格先变回文本；有缩进则先减缩进。

## 同步与备份

- 导出 `ExportPayload.version = 3`，含 `noteBooks`、`notes`（含回收站）。旧载荷缺字段视为空集合。
- SyncBundle 含便签本、便签与删除墓碑；实体级 `updated_at` LWW。
- `is_desktop_visible`、窗口几何、置顶不同步，避免另一台设备自动弹窗。
- 丢失便签本引用的便签归入默认本 `notes-default`。

## 不在首期

提醒、多层便签本、富文本/图片、透明度、自定义主题。管理窗启动组合键已在 **v1.43.0** 可改。
