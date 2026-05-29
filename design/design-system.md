# PwdBook 设计系统

> 平台：Electron 桌面端 · 阶段：UI 设计 · 风格：数字保险库（Digital Vault）

## 设计方向

| 维度 | 定义 |
|------|------|
| 产品定位 | 本地优先的密码管理工具，强调安全、快速、可信 |
| 视觉气质 | 精炼、克制、有质感；像打开一个私人保险库，而非普通 SaaS 后台 |
| 差异化记忆点 | 黄铜色安全 accent + 深色绒面背景 + 等宽密码字段，形成「保险箱」联想 |
| Electron 约束 | 窗口默认 1200×760，最小 960×640；支持系统级暗色；自定义标题栏预留 32px |

## 字体

| 角色 | 字体 | 用途 |
|------|------|------|
| Display | **Fraunces** | 品牌名、解锁页标题、空状态标题 |
| Body | **DM Sans** | 正文、按钮、表单标签 |
| Mono | **IBM Plex Mono** | 密码、密钥、复制字段 |

字重规则：标题比常规少一档（Bold → Semibold）。

## 色彩 Token（三层结构）

### Primitive

```css
--color-ink-950: #0A0C10;
--color-ink-900: #0F1219;
--color-ink-800: #161B26;
--color-ink-700: #1E2433;
--color-ink-600: #2A3144;
--color-ink-400: #6B7289;
--color-ink-200: #C5CAD8;
--color-ink-50:  #F4F5F8;

--color-brass-500: #C9A227;
--color-brass-400: #D4B44A;
--color-brass-300: #E2C978;

--color-teal-500: #2DD4BF;
--color-red-500: #F87171;
--color-green-500: #34D399;
```

### Semantic

```css
--bg-app: var(--color-ink-950);
--bg-surface: var(--color-ink-900);
--bg-elevated: var(--color-ink-800);
--bg-hover: var(--color-ink-700);

--text-primary: var(--color-ink-50);
--text-secondary: var(--color-ink-400);
--text-muted: #5C6478;

--accent-primary: var(--color-brass-500);
--accent-hover: var(--color-brass-400);
--accent-subtle: rgba(201, 162, 39, 0.12);

--border-default: rgba(255, 255, 255, 0.06);
--border-strong: rgba(255, 255, 255, 0.12);
--border-accent: rgba(201, 162, 39, 0.35);

--status-danger: var(--color-red-500);
--status-success: var(--color-green-500);
--status-safe: var(--color-teal-500);
```

### Component

```css
--sidebar-width: 240px;
--detail-width: 360px;
--titlebar-height: 32px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--shadow-panel: 0 24px 80px rgba(0, 0, 0, 0.45);

--input-bg: var(--color-ink-800);
--input-border: var(--border-default);
--input-focus: var(--border-accent);

--btn-primary-bg: var(--accent-primary);
--btn-primary-text: var(--color-ink-950);
--btn-ghost-hover: var(--bg-hover);
```

## 间距与圆角

| Token | 值 | 用途 |
|-------|-----|------|
| space-1 | 4px | 图标与文字间距 |
| space-2 | 8px | 紧凑内边距 |
| space-3 | 12px | 列表项内边距 |
| space-4 | 16px | 卡片内边距 |
| space-6 | 24px | 区块间距 |
| space-8 | 32px | 页面边距 |
| radius-md | 12px | 输入框、按钮 |
| radius-lg | 16px | 面板、卡片 |

## 核心页面

### 1. 解锁页（Lock Screen）
- 居中布局，品牌 logo + 主密码输入
- 错误状态：输入框红色描边 + 轻微 shake 动画

### 2. 主界面（Vault）
- 三栏结构：**侧边栏分类** | **密码列表** | **详情面板**
- 顶栏：搜索框 + 新建按钮 + 设置入口
- 列表项：站点 favicon 占位、标题、账号、最后使用时间
- 选中态：左侧 brass 竖条 + 背景 elevated

### 3. 详情/编辑（Detail Panel）
- 字段：网站名、URL、用户名、密码（显示/隐藏）、备注、标签
- 操作：复制、生成密码、保存、删除
- 密码强度条：弱/中/强 三色

### 4. 设置页（Settings）
- **外观**：浅色 / 深色 / 跟随系统；8 款主题色选色卡；实时预览
- **安全**：自动锁定时间、剪贴板清除
- **数据**：导出 / 导入 / 备份

## 主题系统

### 架构

```
外观模式（mode）          主题色（accent）
├── light  浅色           ├── brass   黄铜（默认）
├── dark   深色           ├── teal    青绿
└── system 跟随系统       ├── indigo  靛蓝
                          ├── rose    玫瑰
                          ├── emerald 翡翠
                          ├── violet  紫罗兰
                          ├── amber   琥珀
                          └── ocean   海洋
```

### HTML 属性

```html
<html data-mode="dark" data-accent="brass" data-mode-pref="system">
```

| 属性 | 值 | 说明 |
|------|-----|------|
| `data-mode` | `dark` / `light` | 当前生效的外观（system 会解析为 dark 或 light） |
| `data-mode-pref` | `dark` / `light` / `system` | 用户选择的模式偏好 |
| `data-accent` | 见上表 | 当前主题强调色 |

### 持久化

```javascript
localStorage.setItem('pwdbook-theme-mode', 'dark');    // dark | light | system
localStorage.setItem('pwdbook-theme-accent', 'teal');  // 选色卡 id
```

### Electron 集成

```javascript
// 主进程 / preload：读取用户偏好，在 loadURL 前注入
const { mode, accent } = store.get('theme');
// 渲染进程启动时调用 PwdBookTheme.init()
// 切换时同步写入 electron-store，并 nativeTheme.themeSource = 'system' | 'dark' | 'light'
```

### 语义 Token 联动

切换 `data-accent` 时，以下变量自动更新：

- `--accent-primary` / `--accent-hover` / `--accent-subtle`
- `--border-accent` / `--focus-ring` / `--texture-glow`
- `--btn-primary-bg`

切换 `data-mode` 时，背景、文字、边框、阴影联动更新，强调色保持不变。

## 组件规范

| 组件 | 默认 | Hover | Active | Disabled |
|------|------|-------|--------|----------|
| Primary Button | brass bg, ink text | brass-400 | scale 0.98 | 40% opacity |
| Ghost Button | transparent | bg-hover | bg-elevated | muted text |
| Input | ink-800 bg, subtle border | border-strong | border-accent + glow | muted bg |
| List Item | transparent | bg-hover | bg-elevated + accent bar | — |
| Tag | accent-subtle bg | — | — | — |

## Electron 实现建议

- **框架**：Electron + React/Vue + Tailwind（与原型 HTML 对齐）
- **窗口**：`frame: false` + 自定义标题栏组件（拖拽区 `-webkit-app-region: drag`）
- **安全 UX**：复制密码后 30s 自动清除剪贴板；详情页失焦自动遮罩密码
- **图标**：Lucide Icons，stroke-width 1.5

## 文件

| 文件 | 说明 |
|------|------|
| `design/tokens.css` | CSS 变量（模式 + 选色卡 + 语义 Token） |
| `design/theme.js` | 主题切换逻辑，Electron 可复用 |
| `design/prototype.html` | 可浏览器打开的交互原型 |
