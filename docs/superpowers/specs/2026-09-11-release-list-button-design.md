# 关于页面软件发布列表入口设计

## 背景

PwdBook 是本地优先且默认不联网的桌面密码管理应用。用户需要在应用的“关于”页面查看软件发布信息，但应用本身不执行版本检查或后台联网。新增一个显式入口，让用户在需要时手动打开项目的 GitHub Releases 页面。

## 目标

- 在设置的“关于”页面提供“软件发布列表”入口。
- 点击入口后使用系统默认浏览器打开固定地址：
  `https://github.com/Tianyu201809/pwd-book/releases`
- 保持应用默认本地运行模式，不新增自动联网、版本检测、更新下载或应用内网页。
- 支持中文和英文界面。

## 方案

在 `src/components/SettingsView.vue` 的关于卡片中增加一个 `UiButton`。按钮点击处理函数调用现有的 `vaultApi.openExternal`，不新增 renderer/preload/main IPC 接口。主进程现有的 `shell:open-external` handler 已限制只允许 `http:` 和 `https:` 协议，并通过 Electron `shell.openExternal` 交给系统默认浏览器。

固定 Releases 地址作为组件内的常量，避免从用户可编辑数据或外部响应中取得目标地址。按钮放在版本和应用描述之后，继续使用关于页现有的卡片布局和设计 token。

## 交互与数据流

1. 用户进入设置的“关于”页。
2. 页面显示应用名称、版本、描述和“软件发布列表”按钮。
3. 用户点击按钮。
4. renderer 调用 `vaultApi.openExternal(RELEASES_URL)`。
5. preload 通过既有 `IPC.shellOpenExternal` 调用主进程。
6. 主进程校验 URL 协议并调用 `shell.openExternal`。
7. 系统默认浏览器打开 GitHub Releases 页面。

打开失败时，组件捕获异常并调用现有 `showToast(parseErrorMessage(error), 'error')` 展示错误提示。成功时不额外显示 toast，也不改变当前设置页状态。

## 文案

在 `src/i18n/locales/zh-CN.ts` 和 `src/i18n/locales/en.ts` 的 `settings` 命名空间增加同名键：

- 中文：`releaseList: '软件发布列表'`
- 英文：`releaseList: 'Release list'`

按钮使用 `ExternalLink` 图标和现有 `UiButton` 样式，确保其符合项目已有的图标按钮规范和键盘可操作性。

## 影响范围

- `src/components/SettingsView.vue`：增加常量、点击处理函数和关于页按钮。
- `src/i18n/locales/zh-CN.ts`：增加中文按钮文案。
- `src/i18n/locales/en.ts`：增加英文按钮文案。

不修改 IPC 协议、主进程外链安全校验、版本号来源和其他设置页功能。

## 验证

- 运行 `npm run typecheck`，确认 Vue 模板、i18n 键和 `vaultApi` 调用类型正确。
- 运行 `npm run lint`，确认新增代码符合项目规则。
- 运行 `npm test`，确认现有测试套件通过。
- 通过代码检查确认按钮位于关于页面、使用固定 Releases URL，并在调用失败时显示错误 toast。
