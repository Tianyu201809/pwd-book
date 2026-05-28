<div align="center">

# PwdBook

### 密码散在浏览器和备忘录里不安全——这是一款只存本机、不上云的桌面密码本

![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)

[快速开始](#install) · [功能概览](#features) · [FAQ](#faq)

</div>

---

> [!IMPORTANT]
> **本地与隐私**
>
> | 项目 | 说明 |
> |------|------|
> | 数据存哪 | 本机 SQLite 文件（见下方路径），不上传云端 |
> | 网络 | 应用**不会**联网同步或上传密码数据 |
> | 加密 | 主密码 scrypt 派生；条目密码 AES-256-GCM |
> | 如何清除 | 设置 → 数据 → 清除所有数据；或手动删除数据库文件 |
> | 卸载 | 卸载程序**不会**自动删库，需手动清除 |

```bash
git clone <your-repo-url>
cd pwd-book
npm install
npm run dev
```

---

## The Problem

账号密码越来越多，写在浏览器、表格或聊天里既难找也不安全。常见密码管理器功能完整，但不少依赖云端同步和订阅。

PwdBook 走另一条路：**数据只在你的电脑上**，用一个主密码解锁。若你用过 KeePass 一类本地库，思路相近；差异在于 Electron 桌面体验、中文界面，以及内置**恢复密钥**（忘记主密码时仍可保留条目）。

---

## See It Work

```bash
# 1. 安装并启动
npm install
npm run dev

# 2. 首次启动 → 创建主密码 → 保存恢复密钥（可跳过，不推荐）

# 3. 解锁后：新建条目 → 填写标题/密码 → 点「保存」
#    顶部会出现 Toast：「创建成功」或具体错误原因（如「密码不能为空」）

# 4. 类型检查与构建
npm run typecheck
npm run build
```

---

## Install

**环境要求：** Node.js 18+、npm

```bash
git clone <your-repo-url>
cd pwd-book
npm install
npm run dev        # 开发模式
npm run build      # 生产构建 → out/
npm run preview    # 预览构建结果
```

<details>
<summary><b>Windows 安装包（exe）</b></summary>

```bash
npm install
npm run dist:win          # 生成 NSIS 安装程序
npm run dist:win:dir      # 仅生成便携版目录（不打包安装程序）
```

产物位于 `release/`：

| 文件 | 说明 |
|------|------|
| `PwdBook-0.1.0-Setup.exe` | 安装程序（推荐分发） |
| `win-unpacked/PwdBook.exe` | 绿色版，可直接运行 |

若 GitHub 下载较慢，可先设置镜像再打包：

```powershell
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
npm run dist:win
```

</details>

<details>
<summary><b>源码构建</b></summary>

`npm run build` 产物位于 `out/main`、`out/preload`、`out/renderer`，供开发预览或自定义打包流程使用。

</details>

---

## Getting Started

1. **创建保险库** — 首次启动设置主密码（至少 4 位），建议完成恢复密钥保存流程。
2. **新建条目** — 左侧「新建条目」，填写标题、网址、用户名、密码；点击头像可**选择彩色图标**。
3. **分类整理** — 侧边栏拖拽排序；底部「分类管理」弹窗中新建/删除分类。
4. **备份** — 设置 → 数据 → 导出 JSON；设置 → 安全 → 恢复与应急 → 导出备份 / 管理恢复密钥。

---

## Features

- 密码条目：标题、网址、用户名、密码、备注、标签、收藏
- 分类：系统分类 + 自定义分类，**拖拽排序**，30+ **彩色图标**
- 条目图标：详情页点击头像，弹窗搜索并选择图标
- 列表：搜索、排序（最近 / 标题 / 创建时间）、复制用户名/密码/整条数据
- 安全：自动锁定、剪贴板定时清除、锁定页**恢复密钥**重置主密码
- 设置：主题色与明暗模式、JSON 导入导出、恢复密钥管理
- 保存反馈：全局 **Toast** 提示成功或失败（如「密码不能为空」）

---

## How It Works

渲染进程（Vue）通过 preload 调用主进程 IPC；主进程持有 sql.js 数据库与加密逻辑。解锁后主密码派生**会话密钥**加密条目密码；锁定后清除内存中的密钥。

<details>
<summary><b>架构与目录</b></summary>

```
渲染进程 (Vue 3)
    ↓ preload / vaultApi
主进程 (Electron)
    ├── vaultService      条目 CRUD、主密码、导入导出
    ├── recoveryService   恢复密钥、重置主密码
    ├── categoryService   分类与侧边栏排序
    ├── settingsService   安全与外观设置
    └── database          sql.js 本地 SQLite
```

```
src/
├── main/           Electron 主进程
├── preload/        安全 API 桥接
├── renderer/       Vue 入口
├── components/     UI（LockScreen、VaultSidebar、PasswordDetail…）
├── composables/    useAppState、useToast、useTheme…
└── shared/         类型、工具、分类图标
```

设计文档：`design/recovery-flow.md`

</details>

<details>
<summary><b>数据存储位置</b></summary>

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%/pwd-book/pwdbook.db` |
| macOS | `~/Library/Application Support/pwd-book/pwdbook.db` |
| Linux | `~/.config/pwd-book/pwdbook.db` |

设置项（含侧边栏分类顺序）保存在同一数据库的 `app_settings` 表。

</details>

<details>
<summary><b>常用命令</b></summary>

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run preview` | 预览构建 |
| `npm run typecheck` | Vue/TS 类型检查 |
| `npm run dist:win` | Windows 安装包 → `release/` |
| `npm run dist:win:dir` | Windows 便携版目录 |

</details>

---

## FAQ

**忘记主密码怎么办？**

若曾保存**恢复密钥**：锁定页 →「使用恢复密钥」→ 验证后设置新主密码，条目保留。  
若未设置恢复密钥：只能「清除保险库」后重新创建（数据不可恢复）。也可在解锁后于 **设置 → 安全 → 恢复与应急** 生成或重新生成恢复密钥。

**恢复密钥丢了还能找回来吗？**

不能。恢复密钥明文**仅创建/重新生成时显示一次**，之后无法查看，只能重新生成（旧密钥失效）。

**数据会上传吗？**

不会。纯本地应用，无云同步。

**如何彻底删除数据？**

设置 → 数据 → 清除所有数据；或删除上文数据库文件。

<details>
<summary><b>更多问题</b></summary>

**JSON 备份里包含密码吗？**

导出为 JSON，含解密后的条目（需在已解锁状态下导出）。请妥善保管备份文件。

**分类下有条目时能否删除分类？**

不能。需先移动或删除该分类下的条目。

**Windows Hello 能用吗？**

界面已预留入口，当前版本尚未实现。

</details>

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面 | Electron 35 + electron-vite |
| 界面 | Vue 3 + TypeScript |
| 数据库 | sql.js（SQLite WASM，本地文件） |
| 加密 | Node.js `crypto` — scrypt + AES-256-GCM |

---

## 文档与贡献

| 文档 | 说明 |
|------|------|
| [docs/code-map/](./docs/code-map/README.md) | 架构图、IPC、数据库与模块导航 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献流程与开发命令 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录 |
| [AGENTS.md](./AGENTS.md) | AI 助手 / 协作者上下文 |
| [SECURITY.md](./SECURITY.md) | 漏洞私下报告 |

---

## License

尚未声明开源许可证；使用前请与仓库维护者确认。
