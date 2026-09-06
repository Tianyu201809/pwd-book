# 剪切板历史（独立小窗口）

**v1.32.0** 在独立渲染窗口中管理本机复制过的文本与图片：轮询系统剪切板、按条过期清理、可选重启后保留。历史记录不写入 SQLite，仅存渲染进程 `sessionStorage` / `localStorage`。**v1.33.0** 设置迁至独立「剪切板」Tab，新增条数上限与使用向导。**v1.34.0** 第一次打开默认不固定；可开快捷模式，回车复制后关窗。未固定时失焦（点到其他程序）会收起小窗。

## 模块一览

| 模块 | 路径 | 职责 |
|------|------|------|
| 小窗口 | `src/main/clipboardWindow.ts` | 无边框置顶窗、`Alt+Shift+O`、未固定失焦隐藏、锁定隐藏 |
| UI | `src/components/ClipboardWindowApp.vue` | 捕获、列表、预览、置顶、过期、分栏拖拽 |
| 样式 | `src/assets/styles/clipboard-window.css` | 小窗口独立样式 |
| 渲染入口 | `src/renderer/clipboard-window.html` + `clipboard-window.ts` | 独立 Vue 应用（`electron.vite.config.ts` → `clipboardWindow`） |
| 设置 | `ClipboardSettingsPanel.vue`、`settingsService.ts` | 开关、清理周期、条数上限、持久化、使用向导 |
| 使用向导 | `src/components/clipboard/ClipboardGuideModal.vue`、`ClipboardGuideVisual.vue` | **v1.33.0** 设置页「使用向导」分步弹窗 |
| 条数上限 | `src/shared/clipboardHistoryLimit.ts` | `20` / `50` / `100` / `200`，默认 `50`；先删最旧未固定项 |
| 入口 | `TitleBar.vue`、`VaultSidebar.vue`、`useAppState.openClipboard` | 标题栏按钮、工具箱子菜单、唤起小窗 |

设置项定义于 `SecuritySettings`（`src/shared/types.ts`），持久化键见 [database-schema.md](./database-schema.md#应用设置)。

## 窗口行为

| 行为 | 说明 |
|------|------|
| 尺寸 | 默认 760×680，最小 560×480；主屏工作区水平居中，距顶 58px |
| 置顶 / 任务栏 | `alwaysOnTop: true`，`skipTaskbar: true` |
| 失焦 | 未固定时隐藏（`shouldHideClipboardWindowOnBlur(pinned)`）；固定后失焦保持可见 |
| 固定小窗 | `clipboard-window:toggle-pinned`；**v1.34.0** 默认未固定（`CLIPBOARD_WINDOW_DEFAULT_PINNED = false`）；与失焦策略独立 |
| 锁定 | `vault:lock` 调用 `hideClipboardWindowOnLock()` |
| 未解锁唤起 | `showClipboardWindow()` 改为 `showFromTray()`，引导先解锁 |
| 功能关闭 | `clipboardEnabled === false` 时拦截小窗，唤起主窗口并提示去设置开启 |
| 主题 | 显示时下发 `theme:changed` 与 `clipboard-window:shown` |
| 退出 | `before-quit` 调用 `destroyClipboardWindow()` |

全局快捷键 `Alt+Shift+O` 在启动与 `settings:update` 时注册，退出前注销。未开启「剪切板历史」时，标题栏、工具箱与快捷键都会拦截小窗，并提示到 **设置 → 剪切板** 开启。

小窗内键盘（**v1.33.0**）：`↑`/`↓` 选择条目，`Enter` 复制，`Ctrl+Enter` / `Meta+Enter` 预览，`Esc` 关闭。**v1.34.0** 开启**快捷模式**后，`Enter` 复制成功即关闭小窗（点击复制按钮不关）。`Delete` / `Backspace` 删除当前选中条目（输入框内除外），先弹出二次确认，确认后选中相邻下一条。列表按钮、预览删除与右键删除同样需要确认。复制成功经小窗 `ToastHost` 提示。

## 设置项

| 字段 | `app_settings` 键 | 默认 | 说明 |
|------|-------------------|------|------|
| `clipboardEnabled` | `clipboard_enabled` | `false` | 开启后每秒轮询系统剪切板（文本 + 图片） |
| `clipboardDefaultExpiry` | `clipboard_default_expiry` | `300` | 新记录默认过期秒数：`30` / `300` / `900` / `1800` / `0`（永不过期） |
| `clipboardPersistence` | `clipboard_persistence` | `false` | `true` 时写入 `localStorage`；关闭时删除持久化副本 |
| `clipboardHistoryLimit` | `clipboard_history_limit` | `50` | **v1.33.0** `20` / `50` / `100` / `200`；先删最旧未固定项 |
| `clipboardQuickMode` | `clipboard_quick_mode` | `false` | **v1.34.0** 小窗「快捷模式」：回车复制后关闭窗口 |

与既有「剪贴板自动清除」（`clipboard_clear_*`，复制密码后清空系统剪贴板）相互独立，后者仍在 **设置 → 安全**。

关闭持久化时，`ClipboardSettingsPanel` 会 `removeItem('pwdbook-clipboard-history')`；开启时若会话里已有记录则拷入 `localStorage`。

## 数据模型（仅渲染进程）

```
ClipboardItem {
  id, kind: 'text' | 'image', content,
  createdAt, pinned, expiry, expiresAt
}
```

| 存储 | 键 | 何时使用 |
|------|-----|----------|
| `sessionStorage` | `pwdbook-clipboard-session` | 始终写入当前会话快照 |
| `localStorage` | `pwdbook-clipboard-history` | 仅 `clipboardPersistence === true` |

- 图片 `content` 为 `data:image/png;base64,...`（主进程 `clipboard.readImage()` → PNG）。
- 相同内容再次捕获会去重并置顶到列表前部；已固定的相同内容只选中、不新建。
- 固定记录不参与过期清理；取消固定后按当前 `expiry` 重新计时。
- 每秒 `purgeExpired()`；筛选：全部 / 文本 / 图片 / 已置顶；文本可搜索并高亮。
- **v1.33.0** 条数超过 `clipboardHistoryLimit` 时先删最旧未固定项；固定项不受上限挤出。

`BroadcastChannel('pwdbook-clipboard')` 用于同文档多实例同步状态（当前仅一个小窗）。

## IPC

| 通道 | 类型 | 说明 |
|------|------|------|
| `clipboard:read-system` | invoke | 读系统剪贴板文本 |
| `clipboard:read-content` | invoke | 读文本 + 图片 Data URL |
| `clipboard:write-image` | invoke | 将 Data URL 写回系统剪贴板 |
| `clipboard:copy-secret` | invoke | 写文本；历史窗复制时 `clearAfterMs = 0`，避免立刻被「自动清除」清掉 |
| `clipboard-window:show` / `hide` | send | 显示 / 隐藏小窗 |
| `clipboard-window:get-pinned` / `toggle-pinned` | invoke | 小窗固定状态 |
| `clipboard-window:shown` | event | 小窗已显示，渲染进程 `refresh()` |

## 用户入口

| 入口 | 条件 |
|------|------|
| 全局快捷键 `Alt+Shift+O` | 始终注册；锁定态引导解锁；功能关闭时拦截并提示去设置 |
| 标题栏剪切板按钮 | 已解锁且非详情小窗口；功能关闭时拦截并提示去设置 |
| 侧栏 **工具箱 → 剪切板** | 已解锁；功能关闭时拦截并提示去设置 |

## 安全边界

- 历史明文只在本机渲染进程存储，不进保险库、不参与 Wi-Fi / 文件夹同步。
- 未解锁不轮询、不展示列表。
- 关闭「剪切板历史」后：不监听系统剪切板，也无法打开小窗；若小窗已打开会立即关闭。
- 持久化开启时，重启后仍可在本机读到历史（含图片 Data URL）；默认关闭。
