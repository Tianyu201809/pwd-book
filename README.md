# PwdBook

[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)](package.json)
![Node](https://img.shields.io/badge/Node.js-%3E%3D20-3c873a?style=flat-square&logo=node.js)
![Electron](https://img.shields.io/badge/Electron-35-47848F?style=flat-square&logo=electron)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)

> 本地优先的密码管理桌面应用 — 数据仅存本机，不上传云端。

[概览](#概览) · [功能](#功能) · [快速开始](#快速开始) · [安全模型](#安全模型) · [项目结构](#项目结构) · [文档](#文档) · [常见问题](#常见问题)

## 概览

**PwdBook** 是一款基于 **Electron + Vue 3 + TypeScript** 的桌面密码库。所有条目保存在本机 SQLite 数据库中，通过主密码解锁；解锁后的会话密钥用于加密存储各条目的密码字段。锁定或退出后，内存中的会话密钥会被清除。

应用采用「数字保险库」视觉风格（深色界面、黄铜色强调色），默认窗口 1200×760，支持自定义标题栏与主题切换。

| 维度 | 说明 |
|------|------|
| 数据位置 | `%APPDATA%/pwd-book/pwdbook.db`（Windows）或 Electron `userData` 目录 |
| 加密 | 主密码 scrypt 校验；条目密码 AES-256-GCM |
| 进程模型 | 主进程（业务与加密）+ Preload 桥 + Vue 渲染进程 |
| 当前平台 | 主要面向 **Windows** 打包（NSIS 安装包） |

## 功能

- **保险库管理** — 分类、收藏、搜索、条目详情（站点、用户名、密码、备注、标签）
- **主密码与锁定** — 首次创建保险库、解锁、手动锁定、空闲自动锁定（5 / 15 / 30 / 60 分钟）
- **恢复密钥** — 忘记主密码时，可用事先保存的恢复密钥重置主密码并保留条目；亦可走「清除保险库」兜底
- **密码工具** — 内置随机密码生成器；复制到剪贴板后可定时自动清空
- **数据导入导出** — JSON 格式备份与恢复（导出文件含明文密码，请离线妥善保管）
- **外观设置** — 主题与界面偏好（见 `AppearancePanel`）
- **即将支持** — Windows Hello 生物识别解锁（界面已预留入口）

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
| `npm run dist:win` | 构建并生成 Windows NSIS 安装包（输出 `release/`） |
| `npm run dist:win:dir` | 构建未打包目录版，便于本地调试安装结果 |

> [!TIP]
> 仓库根目录 `.npmrc` 默认使用国内 npm 镜像，若你在海外环境遇到依赖安装问题，可临时改回官方 registry。

### 首次使用

1. 启动应用后，在锁定页**创建主密码**并初始化保险库。
2. 按引导**保存恢复密钥**（仅展示一次，请抄写到安全位置）。
3. 解锁后即可添加分类与密码条目。

> [!WARNING]
> 未配置恢复密钥且忘记主密码时，只能通过「清除保险库」重置，**所有条目将不可恢复**。请务必在设置中完成恢复密钥配置。

## 安全模型

```
主密码 ──scrypt──► 校验哈希（仅存 salt + hash）
       └──scrypt──► 会话密钥（内存，锁定后清除）
                         └── AES-256-GCM ──► 各条目 password_encrypted
```

- **本地存储**：无 `.env`、无云端同步；配置与安全策略写入 `app_settings` 表。
- **恢复密钥**：独立 scrypt 校验；用恢复密钥包装会话密钥，支持主密码重置后的条目重加密。
- **剪贴板**：可选在复制后 N 秒清空剪贴板（若内容未被用户改写）。
- **导出文件**：`data:export` 生成的 JSON 包含**明文密码**，勿上传至网盘或聊天工具。

更细的 IPC 与恢复流程见 [docs/code-map/ipc-and-data-flow.md](./docs/code-map/ipc-and-data-flow.md) 与 [design/recovery-flow.md](./design/recovery-flow.md)。

## 项目结构

```
pwd-book/
├── src/
│   ├── main/           # Electron 主进程：IPC、加密、SQLite、业务服务
│   ├── preload/        # contextBridge API（window.electronAPI）
│   ├── renderer/       # Vue 入口
│   ├── components/     # UI（含 recovery/ 恢复流程组件）
│   ├── composables/    # useAppState、useTheme、useAutoLock 等
│   └── shared/         # 类型、IPC 常量、工具函数
├── design/             # 设计系统、原型与恢复流程规范
├── docs/code-map/      # 架构与代码导航（贡献者 / AI 助手）
└── electron.vite.config.ts
```

技术栈摘要：**Electron 35** · **Vue 3** · **sql.js**（WASM SQLite）· **lucide-vue-next** · Node `crypto`（scrypt / AES-GCM）

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
Electron `app.getPath('userData')` 下的 `pwdbook.db`。卸载应用不会自动删除该文件，如需彻底清除请手动删除用户数据目录。

**能否多端同步？**  
当前版本不支持。可自行通过「设置 → 数据」导出 JSON，再在其他机器导入。

**忘记主密码怎么办？**  
若曾保存恢复密钥：锁定页 →「使用恢复密钥」→ 验证后设置新主密码。若未配置恢复密钥：只能清除保险库后重新创建。

**如何参与开发？**  
从 [docs/code-map/README.md](./docs/code-map/README.md) 的「快速定位」表入手；改 IPC 看 `src/main/ipc/handlers.ts`，改 UI 状态看 `src/composables/useAppState.ts`。

---

**PwdBook** — 你的密码，只留在你的电脑上。
