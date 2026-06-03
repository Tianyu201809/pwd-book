<div align="center">

# PwdBook

### 密码散落各处、记不住主密码、又不愿把数据交给云端？PwdBook 把保险库留在你的电脑上。

[![Version](https://img.shields.io/badge/version-1.3.0-blue?style=flat-square)](package.json)
![Node](https://img.shields.io/badge/Node.js-%3E%3D20-3c873a?style=flat-square&logo=node.js)
![Electron](https://img.shields.io/badge/Electron-35-47848F?style=flat-square&logo=electron)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)

[概览](#概览) · [产品截图](#产品截图) · [功能](#功能) · [版本更新](#版本更新) · [快速开始](#快速开始) · [安全模型](#安全模型) · [项目结构](#项目结构) · [文档](#文档) · [常见问题](#常见问题)

</div>

---

> [!IMPORTANT]
> **本地优先，默认不上网。** 保险库数据仅存本机 `%APPDATA%/PwdBook/pwdbook.db`（Windows）或 Electron `userData` 目录；无遥测、无云端同步。
>
> **可选邮箱备份** 会在你主动配置 SMTP 并发送时，向指定邮件服务器建立出站连接；备份内容为 AES-256 加密 ZIP，解压密码为主密码。
>
> **卸载：** NSIS 安装程序卸载时可选择是否删除本地密码数据（见 `deps/installer.nsh`）；应用内「清除所有数据」会 wipe 本地库。

```bash
git clone <your-repo-url>
cd pwd-book
npm install
npm run dev
```

---

## 概览

**PwdBook** 是一款 **Electron + Vue 3 + TypeScript** 桌面密码库。所有条目保存在本机 SQLite 数据库中，通过主密码解锁；解锁后的会话密钥用于加密各条目的密码字段，锁定或退出后内存中的会话密钥会被清除。

若你用过 KeePass、Bitwarden 离线库或 1Password 本地 vault，核心思路相同：**主密码 + 本地加密存储**。PwdBook 的差异在于开箱即用的桌面体验、恢复密钥流程，以及可选的加密邮箱灾备。

应用提供「数字保险库」与 **Animal Island** 两套视觉皮肤，支持中英文界面；默认窗口 1200×760，自定义标题栏，主要面向 **Windows** 打包（NSIS 安装包）。

<p align="center">
  <img src="./docs/images/main.png" alt="PwdBook 主界面：侧栏分类、搜索与条目列表" width="720" />
</p>
<p align="center"><em>主界面 — 分类导航、搜索与密码条目管理</em></p>

| 维度 | 说明 |
|------|------|
| 数据位置 | `%APPDATA%/PwdBook/pwdbook.db`（Windows）或 Electron `userData` 目录 |
| 加密 | 主密码 scrypt 校验；条目密码 AES-256-GCM |
| 进程模型 | 主进程（业务与加密）+ Preload 桥 + Vue 渲染进程 |
| 当前平台 | 主要面向 **Windows** 打包（NSIS 安装包） |

## 产品截图

### 锁定与恢复

<p align="center">
  <img src="./docs/images/lock.png" alt="锁定页：输入主密码解锁保险库" width="480" />
</p>
<p align="center"><em>锁定页 — 主密码解锁；支持恢复密钥入口</em></p>

<p align="center">
  <img src="./docs/images/reset.png" alt="恢复访问：恢复密钥、JSON 备份或清除数据" width="480" />
</p>
<p align="center"><em>恢复访问 — 恢复密钥重置主密码、从 JSON 备份恢复，或清除后重建</em></p>

### 设置

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/images/setting-safe.png" alt="设置 - 安全：自动锁定、剪贴板、关闭窗口、恢复密钥" width="100%" />
      <br /><sub>安全 — 自动锁定、剪贴板清除、关闭窗口行为、恢复密钥</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/images/lang-theme.png" alt="设置 - 外观：语言、深浅色、主题色" width="100%" />
      <br /><sub>外观 — 中英文、经典/Animal Island 皮肤、浅色/深色/跟随系统、八种强调色</sub>
    </td>
  </tr>
  <tr>
    <td colspan="2" align="center">
      <img src="./docs/images/data.png" alt="设置 - 数据：导出备份、导入数据、清除所有数据" width="480" />
      <br /><sub>数据 — JSON / Excel 导出、导入恢复、清除全部数据</sub>
    </td>
  </tr>
</table>

### Animal Island 皮肤

治愈系 **Animal Island** 主题（基于 [animal-island-vue](https://www.npmjs.com/package/animal-island-vue)），与经典「数字保险库」皮肤可一键切换。

<p align="center">
  <img src="./docs/images/animal-main.png" alt="Animal Island 主界面：侧栏、条目列表与详情" width="720" />
</p>
<p align="center"><em>主界面 — 柔和配色、圆角卡片与装饰背景</em></p>

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/images/animal-lock.png" alt="Animal Island 锁定页" width="100%" />
      <br /><sub>锁定页 — 主密码解锁</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/images/animal-appearance.png" alt="Animal Island 外观设置" width="100%" />
      <br /><sub>外观 — 皮肤切换与组件预览</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/images/animal-password-gen.png" alt="Animal Island 随机密码工具" width="100%" />
      <br /><sub>随机密码 — 长度与字符集配置</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/images/animal-email-backup.png" alt="Animal Island 邮箱备份" width="100%" />
      <br /><sub>邮箱备份 — SMTP 配置与加密 ZIP 发送</sub>
    </td>
  </tr>
</table>

## 功能

### 保险库与条目

- **分类** — 自定义分类名称与图标；侧栏支持拖拽排序；**自定义分类右键可编辑、删除**（空分类可删）；分类管理中支持名称内联编辑、点击图标更换
- **标签** — 侧栏「标签管理」：新建、重命名、删除（同步更新所有关联条目）；详情页从已有标签中选用，支持搜索与条目数统计
- **浏览** — 全部 / 收藏筛选、标题搜索、**最近使用 / 标题 A–Z / 创建时间** 排序、条目列表与详情侧栏
- **条目字段** — 标题、网址、用户名、密码、备注、标签、显示图标、所属分类、**本地程序路径**（可选，用于右键或快捷条启动 exe）
- **详情侧栏** — 选中条目或点击「新建条目」时自动展开；**打开已有条目时默认为只读**，点「编辑」后再改；左缘可收起（偏好写入 `localStorage`）；拖拽左缘调整宽度（280–560px）；网址旁一键复制；新建时可一键生成密码，取消创建会收起侧栏
- **列表操作** — 右键或「⋯」菜单：**复制到剪贴板**、**创建副本**（标题追加 ` - 副本`）、删除、**移动到其他分类**、**打开网址**（是否向 URL 追加 `user` / `pwd` 由设置控制）、**打开程序**（已填本地路径时）；右键条目时会同步选中并高亮
- **侧栏快捷操作** — 分类搜索框旁 **「+」** 可快速新建分类；底部「工具与设置」默认收起，可展开访问邮箱备份、随机密码、设置等

### 主密码、锁定与恢复

- **首次使用** — 创建主密码并初始化保险库；已有本地库时锁定页显示「解锁」而非「创建主密码」
- **日常使用** — 主密码解锁、手动锁定、空闲自动锁定（5 / 15 / 30 / 60 分钟，可在设置中调整）
- **恢复密钥** — 忘记主密码时，可用事先保存的恢复密钥重置主密码并保留条目；亦可走「清除保险库」兜底

### 工具

- **随机密码** — 独立工具页，可配置长度与字符集，一键生成、复制或应用到当前条目
- **邮箱备份** — 将保险库打包为 **AES-256 密码 ZIP**（内含 JSON 可导入 + Excel 便于查看），通过 SMTP 发送至你的安全邮箱；支持手动 / 每周 / 每月频率，到期时应用内提醒
- **密码生成器** — 详情页与工具页均可快速唤起

### 数据导入导出

- **JSON** — 完整备份与恢复（含明文密码，请离线妥善保管）；导入时自动创建备份中缺失的分类
- **Excel** — 导出 `.xlsx`，含「密码条目」与「分类」两个工作表，便于查阅与归档
- **从其他应用导入** — 向导式导入 **KeePass / Enpass / Bitwarden / 1Password / Chrome** 导出的 CSV，或 **PwdBook JSON**；上传前可查看各来源的导出说明与常见列名；导入前预览「将导入 / 重复跳过 / 无效」条目
- **导出到其他应用** — 按上述应用的 CSV 列格式导出，便于迁移或与其他密码库并用

### 外观

- **皮肤** — **经典保险库**（浅色 / 深色 / 跟随系统 + 八种强调色）或 **Animal Island**（基于 [animal-island-vue](https://www.npmjs.com/package/animal-island-vue) 的治愈系 UI）
- **语言** — 简体中文、English（`vue-i18n`）

### 窗口与系统集成（Windows）

- **系统托盘** — 标题栏「−」或关闭流程可选「最小化到托盘」；托盘图标点击可重新显示窗口；托盘菜单可打开 **快捷搜索**
- **悬浮快捷搜索条** — 置顶细长搜索窗（默认 `Alt+Shift+P`）；输入后 `Enter` **直接打开网址或启动本地程序**；无输入时显示**最近打开**（最多 5 条，可手动移除）；可在 **设置 → 安全** 启用/禁用
- **快捷键唤起主窗口** — 全局快捷键（默认 `Alt+Shift+M`）显示并聚焦主窗口；可在 **设置 → 安全** 启用/禁用
- **关闭行为** — 设置 → 安全：每次询问、默认最小化到托盘、或直接退出；标题栏关闭对话框可勾选「记住选择」
- **单实例** — 重复启动已运行的实例时，会聚焦已有窗口并提示应用已在运行

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) **20 LTS** 或更高版本
- npm（随 Node 安装）
- Windows（开发与 `dist:win` 打包；其他平台未在 `electron-builder` 中配置）

### 安装与开发

```bash
git clone <your-repo-url>
cd pwd-book
npm install
npm run dev
```

`npm run dev` 会启动 electron-vite 开发模式，热重载渲染进程与主进程代码。

### 其他命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译到 `out/`（main / preload / renderer） |
| `npm run preview` | 预览生产构建 |
| `npm run typecheck` | Vue + TypeScript 类型检查 |
| `npm run icons` | 从 `icon.png` 生成应用图标资源 |
| `npm run dist:win` | 构建并生成 Windows NSIS 安装包（输出 `release/`） |
| `npm run dist:win:dir` | 构建未打包目录版，便于本地调试安装结果 |
| `npm run screenshots:animal` | 生成 Animal Island 主题 README 截图（输出 `docs/images/animal-*.png`） |

> [!TIP]
> 仓库根目录 `.npmrc` 默认使用国内 npm 镜像，若你在海外环境遇到依赖安装问题，可临时改回官方 registry。

### 首次使用

1. **首次启动**：在锁定页创建主密码并初始化保险库。
2. 按引导**保存恢复密钥**（仅展示一次，请抄写到安全位置）。
3. 解锁后即可添加分类与密码条目。
4. **再次启动**（已有本地库）：锁定页显示解锁表单，输入主密码后进入保险库。

> [!WARNING]
> 未配置恢复密钥且忘记主密码时，只能通过「清除保险库」重置，**所有条目将不可恢复**。请务必在设置中完成恢复密钥配置。

## 安全模型

```
主密码 ──scrypt──► 校验哈希（仅存 salt + hash）
       └──scrypt──► 会话密钥（内存，锁定后清除）
                         └── AES-256-GCM ──► 各条目 password_encrypted
```

- **本地存储**：默认无云端同步；安全与界面偏好写入 `app_settings` 表。
- **恢复密钥**：独立 scrypt 校验；用恢复密钥包装会话密钥，支持主密码重置后的条目重加密。
- **剪贴板**：可选在复制后 N 秒清空剪贴板（若内容未被用户改写）。
- **导出文件**：JSON / Excel 均包含**明文密码**，勿上传至网盘或聊天工具。
- **邮箱备份**：ZIP 使用 AES-256 加密，解压密码为主密码；SMTP 凭据经会话密钥加密后存于本地设置。
- **打开网址（携带参数）**：在 **设置 → 安全** 开启后，列表菜单打开网址时会附加 `user` / `pwd`；快捷搜索条 `Enter` 遵循同一设置。请勿对不可信站点使用。

## 版本更新

### v1.3.0（当前）

完整变更列表见 **[CHANGELOG.md](./CHANGELOG.md#130---2026-06-03)**。摘要：

| 类别 | 内容 |
|------|------|
| 分类 | 侧栏自定义分类右键编辑、删除（空分类） |
| 条目 | **创建副本**；右键时选中并高亮当前条目 |
| 体验 | 菜单文案「复制到剪贴板」与「创建副本」区分歧义 |
| 修复 | 分类右键「编辑」国际化缺失 |

### v1.2.1

快捷条「最近打开」、全局快捷键唤起主窗口（`Alt+Shift+M`）、列表菜单与子菜单定位优化等。详见 **[CHANGELOG.md#121---2026-06-02](./CHANGELOG.md#121---2026-06-02)**。

### v1.2.0

完整变更列表见 **[CHANGELOG.md#120---2026-06-02](./CHANGELOG.md#120---2026-06-02)**。摘要：

| 类别 | 内容 |
|------|------|
| 快捷访问 | 悬浮快捷搜索条（`Alt+Shift+P`），Enter 打开程序/网址 |
| 迁移 | 多来源 CSV 导入向导、多格式 CSV 导出 |
| 条目 | 本地程序路径、详情默认只读、侧栏快速新建分类 |
| 安全/行为 | 「打开网址携带账号密码」改为设置项开关 |
| 体验 | 搜索框清除按钮、侧栏工具区默认收起、UI 与动森指针修复 |

### v1.1.1

补丁版本，修复详情侧栏布局、长文本溢出、右键菜单定位与滚动条样式。详见 **[CHANGELOG.md](./CHANGELOG.md#111---2026-05-30)**。v1.1.0 的标签管理、列表排序等能力见 **[CHANGELOG.md#110---2026-05-30](./CHANGELOG.md#110---2026-05-30)**。

<details>
<summary><b>详情</b> — IPC 数据流与恢复流程</summary>

更细的 IPC 与恢复流程见 [docs/code-map/ipc-and-data-flow.md](./docs/code-map/ipc-and-data-flow.md) 与 [design/recovery-flow.md](./design/recovery-flow.md)。

邮箱备份流程：解锁状态下读取条目 → 生成 JSON + Excel → 打包 AES-256 密码 ZIP → 经 nodemailer 发送至配置的收件邮箱。

</details>

## 项目结构

```
pwd-book/
├── src/
│   ├── main/           # Electron 主进程：IPC、加密、SQLite、标签/分类服务、托盘、单实例、邮箱备份
│   ├── preload/        # contextBridge API（window.electronAPI）
│   ├── renderer/       # 主窗口 index.html 与 quickbar.html 双入口
│   ├── components/     # UI（LockScreen、VaultView、QuickBarApp、import/、export/ 等）
│   ├── composables/    # useAppState、useTheme、useAutoLock、useLocale 等
│   ├── i18n/           # 中英文文案
│   └── shared/         # 类型、IPC、导入/导出解析、launchEntry、entrySearch 等
├── deps/               # 打包依赖脚本（NSIS 卸载时可选删除用户数据）
├── docs/images/        # README 等产品截图
├── design/             # 设计系统、原型与恢复流程规范
├── docs/code-map/      # 架构与代码导航（贡献者 / AI 助手）
└── electron.vite.config.ts
```

技术栈摘要：**Electron 35** · **Vue 3** · **vue-i18n** · **sql.js**（WASM SQLite）· **lucide-vue-next** · **animal-island-vue** · **xlsx** · **nodemailer** · Node `crypto`（scrypt / AES-GCM）

## 文档

| 文档 | 内容 |
|------|------|
| [CHANGELOG.md](./CHANGELOG.md) | **版本更新日志**（自 v1.1.0 起） |
| [docs/code-map/README.md](./docs/code-map/README.md) | 代码地图索引 |
| [docs/code-map/overview.md](./docs/code-map/overview.md) | 三层进程模型与目录说明 |
| [docs/code-map/database-schema.md](./docs/code-map/database-schema.md) | 表结构与 `app_settings` 键 |
| [design/design-system.md](./design/design-system.md) | 色彩、字体与组件 Token |
| [design/recovery-flow.md](./design/recovery-flow.md) | 恢复密钥 UX 与文案规范 |

## 常见问题

**数据存在哪里？**  
Electron `app.getPath('userData')` 下的 `pwdbook.db`（Windows 上通常为 `%APPDATA%\PwdBook`）。通过 NSIS 安装程序卸载时会询问是否删除本地密码数据（见 `deps/installer.nsh`）；选择「否」则仅移除程序，数据保留。应用内覆盖安装（升级）不会弹出提示，也不会删除数据。

**能否多端同步？**  
当前版本不支持内置云同步。可自行通过「设置 → 数据」导出 JSON，再在其他机器导入；或使用「邮箱备份」将加密 ZIP 发到自己的邮箱作灾备。

**忘记主密码怎么办？**  
若曾保存恢复密钥：锁定页 →「使用恢复密钥」→ 验证后设置新主密码。若未配置恢复密钥：只能清除保险库后重新创建。

**邮箱备份会上传明文吗？**  
不会。备份以 AES-256 密码 ZIP 发送，解压密码为你的主密码；ZIP 内同时含 JSON（可导入）与 Excel（便于查看）。仅在你配置 SMTP 并主动发送（或确认定时提醒）时才会联网。

**最小化后找不到窗口？**  
查看任务栏右侧系统托盘中的 PwdBook 图标，单击即可恢复窗口。

**重复打开安装包或快捷方式？**  
应用为单实例；第二次启动会激活已有进程并提示，不会打开第二个数据目录实例。

**「打开网址（携带账号密码）」安全吗？**  
在 **设置 → 安全** 中默认关闭；开启后，列表菜单与快捷搜索条打开网址时会写入 `user` / `pwd` 查询参数。仅适合你自己信任、且确实从 URL 读取凭据的页面；对普通 HTTPS 登录页无帮助，且 URL 可能留在浏览器历史记录中，请谨慎使用。

**快捷搜索条怎么用？**  
解锁后按 `Alt+Shift+P`（或在设置中点击「打开快捷条」）。无输入时显示**最近打开**（最多 5 条，悬停可 × 移除）；输入关键词后 ↑↓ 选择条目，`Enter` 启动本地程序或打开网址（优先程序路径）。失焦后快捷条自动隐藏。移除最近打开**不会**删除条目，也不会清除主列表的「最近使用时间」；全部移除后列表保持为空，直到再次打开条目。详见 [docs/code-map/quickbar-and-shortcuts.md](./docs/code-map/quickbar-and-shortcuts.md)。

**如何用快捷键唤起主窗口？**  
默认 `Alt+Shift+M`（可在 **设置 → 安全 → 快捷键唤起主窗口** 开关）。窗口最小化到托盘时也可通过该快捷键恢复。

**如何参与开发？**  
从 [docs/code-map/README.md](./docs/code-map/README.md) 的「快速定位」表入手；改 IPC 看 `src/main/ipc/handlers.ts`，改 UI 状态看 `src/composables/useAppState.ts`，标签逻辑见 `src/main/services/tagService.ts` 与 `TagManagePanel.vue`，托盘与关闭逻辑见 `src/main/tray.ts`，快捷条与最近打开见 [docs/code-map/quickbar-and-shortcuts.md](./docs/code-map/quickbar-and-shortcuts.md)，邮箱备份见 `src/main/services/emailBackupService.ts`。

---

**PwdBook** — 你的密码，只留在你的电脑上。
