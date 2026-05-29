# PwdBook

[![Version](https://img.shields.io/badge/version-0.2.0-blue?style=flat-square)](package.json)
![Node](https://img.shields.io/badge/Node.js-%3E%3D20-3c873a?style=flat-square&logo=node.js)
![Electron](https://img.shields.io/badge/Electron-35-47848F?style=flat-square&logo=electron)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)

> 本地优先的密码管理桌面应用 — 数据仅存本机，不上传云端。

[概览](#概览) · [功能](#功能) · [快速开始](#快速开始) · [安全模型](#安全模型) · [项目结构](#项目结构) · [文档](#文档) · [常见问题](#常见问题)

## 概览

**PwdBook** 是一款基于 **Electron + Vue 3 + TypeScript** 的桌面密码库。所有条目保存在本机 SQLite 数据库中，通过主密码解锁；解锁后的会话密钥用于加密存储各条目的密码字段。锁定或退出后，内存中的会话密钥会被清除。

应用采用「数字保险库」视觉风格（深色界面、黄铜色强调色），默认窗口 1200×760，支持自定义标题栏、主题与中英文界面。

| 维度 | 说明 |
|------|------|
| 数据位置 | `%APPDATA%/PwdBook/pwdbook.db`（Windows）或 Electron `userData` 目录 |
| 加密 | 主密码 scrypt 校验；条目密码 AES-256-GCM |
| 进程模型 | 主进程（业务与加密）+ Preload 桥 + Vue 渲染进程 |
| 当前平台 | 主要面向 **Windows** 打包（NSIS 安装包） |

## 功能

### 保险库与条目

- **分类** — 自定义分类名称与图标；分类管理中支持名称内联编辑、点击图标更换
- **浏览** — 全部 / 收藏筛选、标题搜索、条目列表与详情侧栏
- **条目字段** — 标题、网址、用户名、密码、备注、标签、显示图标、所属分类
- **详情侧栏** — 左缘可收起；拖拽左缘调整宽度（280–560px，偏好写入 `localStorage`）；网址旁一键复制
- **列表操作** — 右键或「⋯」菜单：复制条目信息、删除、**移动到其他分类**、**在浏览器中打开网址**（向 URL 追加 `user` / `pwd` 查询参数，便于部分站点自动填表）

### 主密码、锁定与恢复

- **首次使用** — 创建主密码并初始化保险库；已有本地库时锁定页显示「解锁」而非「创建主密码」
- **日常使用** — 主密码解锁、手动锁定、空闲自动锁定（5 / 15 / 30 / 60 分钟，可在设置中调整）
- **恢复密钥** — 忘记主密码时，可用事先保存的恢复密钥重置主密码并保留条目；亦可走「清除保险库」兜底

### 工具与数据

- **密码生成器** — 内置随机密码生成
- **剪贴板** — 复制密码等敏感内容后，可按设置定时自动清空（默认 30 秒）
- **导入导出** — JSON 格式备份与恢复（导出文件含明文密码，请离线妥善保管）

### 外观

- **主题** — 浅色 / 深色 / 跟随系统，多种强调色
- **语言** — 简体中文、English（`vue-i18n`）

### 窗口与系统集成（Windows）

- **系统托盘** — 标题栏「−」或关闭流程可选「最小化到托盘」；托盘图标点击可重新显示窗口
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

- **本地存储**：无云端同步；安全与界面偏好写入 `app_settings` 表。
- **恢复密钥**：独立 scrypt 校验；用恢复密钥包装会话密钥，支持主密码重置后的条目重加密。
- **剪贴板**：可选在复制后 N 秒清空剪贴板（若内容未被用户改写）。
- **导出文件**：`data:export` 生成的 JSON 包含**明文密码**，勿上传至网盘或聊天工具。
- **打开网址（携带参数）**：仅在用户主动选择该菜单项时，用系统默认浏览器打开带 `user` / `pwd` 的 URL；请勿对不可信站点使用。

更细的 IPC 与恢复流程见 [docs/code-map/ipc-and-data-flow.md](./docs/code-map/ipc-and-data-flow.md) 与 [design/recovery-flow.md](./design/recovery-flow.md)。

## 项目结构

```
pwd-book/
├── src/
│   ├── main/           # Electron 主进程：IPC、加密、SQLite、托盘、单实例
│   ├── preload/        # contextBridge API（window.electronAPI）
│   ├── renderer/       # Vue 入口
│   ├── components/     # UI（LockScreen、PasswordList、PasswordDetail、EntryListMenu 等）
│   ├── composables/    # useAppState、useTheme、useAutoLock、useLocale 等
│   ├── i18n/           # 中英文文案
│   └── shared/         # 类型、IPC 常量、工具函数（含 URL 参数拼接）
├── deps/               # 打包依赖脚本（NSIS 卸载时可选删除用户数据）
├── design/             # 设计系统、原型与恢复流程规范
├── docs/code-map/      # 架构与代码导航（贡献者 / AI 助手）
└── electron.vite.config.ts
```

技术栈摘要：**Electron 35** · **Vue 3** · **vue-i18n** · **sql.js**（WASM SQLite）· **lucide-vue-next** · Node `crypto`（scrypt / AES-GCM）

## 文档

| 文档 | 内容 |
|------|------|
| [docs/code-map/README.md](./docs/code-map/README.md) | 代码地图索引 |
| [docs/code-map/overview.md](./docs/code-map/overview.md) | 三层进程模型与目录说明 |
| [docs/code-map/database-schema.md](./docs/code-map/database-schema.md) | 表结构与 `app_settings` 键 |
| [design/design-system.md](./design/design-system.md) | 色彩、字体与组件 Token |
| [design/recovery-flow.md](./design/recovery-flow.md) | 恢复密钥 UX 与文案规范 |

## 常见问题

**数据存在哪里？**  
Electron `app.getPath('userData')` 下的 `pwdbook.db`（Windows 上通常为 `%APPDATA%\PwdBook`）。通过 NSIS 安装程序卸载时会询问是否删除本地密码数据（见 `deps/installer.nsh`）；选择「否」则仅移除程序，数据保留。应用内覆盖安装（升级）不会弹出提示，也不会删除数据。

**能否多端同步？**  
当前版本不支持。可自行通过「设置 → 数据」导出 JSON，再在其他机器导入。

**忘记主密码怎么办？**  
若曾保存恢复密钥：锁定页 →「使用恢复密钥」→ 验证后设置新主密码。若未配置恢复密钥：只能清除保险库后重新创建。

**最小化后找不到窗口？**  
查看任务栏右侧系统托盘中的 PwdBook 图标，单击即可恢复窗口。

**重复打开安装包或快捷方式？**  
应用为单实例；第二次启动会激活已有进程并提示，不会打开第二个数据目录实例。

**「打开网址（携带账号密码）」安全吗？**  
该功能会把用户名、密码写入 URL 查询参数，仅适合你自己信任、且确实从 URL 读取凭据的页面；对普通 HTTPS 登录页无帮助，且 URL 可能留在浏览器历史记录中，请谨慎使用。

**如何参与开发？**  
从 [docs/code-map/README.md](./docs/code-map/README.md) 的「快速定位」表入手；改 IPC 看 `src/main/ipc/handlers.ts`，改 UI 状态看 `src/composables/useAppState.ts`，托盘与关闭逻辑见 `src/main/tray.ts`。

---

**PwdBook** — 你的密码，只留在你的电脑上。
