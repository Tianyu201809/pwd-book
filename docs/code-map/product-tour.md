# 产品引导（Product Tour）

**v1.24.0** 交互式新手引导：标题栏 **产品学习**（学士帽）→ 引导中心 → 分步聚光灯/遮罩高亮。**v1.25.0** 适配侧栏底部图标栏与列表工具栏标签筛选的新 UI 布局。

## 用户流程

1. 保险库**已解锁**时，标题栏换肤按钮旁显示 **学士帽**（`TitleBar.vue`，`data-tour="titlebar-learn"`）。
2. 点击打开 **引导中心**（`ProductTourHubModal.vue`）— 6 张路径卡片，已完成项显示 ✓（`localStorage` `pwdbook-tour-done-{id}`）。
3. 选择路径后进入 **引导层**（`ProductTourOverlay.vue`）：聚光灯或整屏遮罩 + 居中/锚定卡片；**上一步 / 下一步 / 跳过**；支持 **← → Enter Esc**。

## 六条引导路径

| ID | 名称 | 步骤要点 |
|----|------|----------|
| `intro` | 快速认识 | 欢迎 → **三栏示意**（`highlight: columns`）→ 分类 → 列表工具栏 |
| `organize` | 分类与标签 | 分类、**列表工具栏标签筛选**、新建分类、侧栏底部入口 |
| `entries` | 条目管理 | 搜索、排序/布局、新建、详情侧栏 |
| `tools` | 实用工具 | **工具箱**、随机密码、密码健康、回收站 |
| `titlebar` | 标题栏快捷 | 换肤、锁定、置顶、学习入口 |
| `settings` | 设置中心 | 侧栏 **设置** 图标 → 设置 Tab → 安全 / 数据 |

步骤定义：`src/components/tour/productTourCatalog.ts`。文案：`i18n` 键 `productTour.*`。

## 架构

```
TitleBar.openHub()
  → useProductTour.openHub() / startTour(id)
    → runStepPrepare(step)     # navigateTo、switchSettingsTab、TOUR_PREPARE_EVENT
    → ProductTourOverlay       # 布局、聚光灯、GSAP 动画
VaultSidebar / PasswordList     # 监听 TOUR_PREPARE_EVENT 展开工具箱/管理/标签筛选
```

| 模块 | 路径 |
|------|------|
| 状态 | `src/composables/useProductTour.ts` |
| 类型 | `src/shared/productTourTypes.ts` |
| 步骤表 | `src/components/tour/productTourCatalog.ts` |
| 引导层 UI | `src/components/tour/ProductTourOverlay.vue` |
| 引导中心 | `src/components/tour/ProductTourHubModal.vue` |
| 样式 | `src/assets/styles/product-tour.css`（`global.css` 引入） |
| 挂载 | `App.vue`（主窗口根，经典/动森均挂载） |

## 高亮模式（`ProductTourStep.highlight`）

| 模式 | 行为 |
|------|------|
| `spotlight`（默认） | 单目标 `box-shadow` 聚光灯 + 卡片锚定目标 |
| `backdrop` | 整屏半透明遮罩 + **居中卡片**（全视窗级目标自动回退） |
| `columns` | 整屏遮罩 + 三栏 `1/2/3` 边框高亮 + 居中卡片（快速认识第 2 步） |

`cardPlacement: 'center'` 强制引导卡片居中；`placement` 仅影响 spotlight 模式下卡片相对目标的方向。

## 锚点（`data-tour`）

| 属性值 | 组件 |
|--------|------|
| `titlebar-learn` / `titlebar-skin` / `titlebar-lock` / `titlebar-pin` | `TitleBar.vue` |
| `vault-layout` / `vault-col-sidebar` / `vault-col-list` / `vault-col-detail` | `VaultView.vue` |
| `sidebar-categories` / `sidebar-new-category` / `sidebar-utilities` | `VaultSidebar.vue` |
| `sidebar-toolbox` / `sidebar-toolbox-panel` / `sidebar-manage` / `sidebar-manage-panel` | `VaultSidebar.vue`（**v1.25.0**） |
| `tool-password-gen` / `tool-password-health` / `tool-trash` / `sidebar-settings` | `VaultSidebar.vue` |
| `list-search` / `list-toolbar` / `list-new-entry` / `list-actions` | `PasswordList.vue` |
| `list-tag-filter` / `list-tag-filter-panel` | `PasswordList.vue`（**v1.25.0**，原 `sidebar-tag-filter`） |
| `detail-panel` | `PasswordDetail.vue` |
| `settings-nav` / `settings-security` / `settings-data` | `SettingsView.vue` |

> **v1.25.0 前** 锚点 `sidebar-tag-filter` 位于 `VaultSidebar.vue`，已移除。

新增引导步骤：在 catalog 增加 `ProductTourStep`，在对应 DOM 加 `data-tour`，补充 `zh-CN.ts` / `en.ts` 文案。

## 步骤准备（`prepare` / `runStepPrepare`）

| 动作 | 说明 |
|------|------|
| `expand-utilities` | （**v1.24.0**，已废弃）原展开「工具与设置」 |
| `expand-toolbox` | **v1.25.0** `VaultSidebar` 展开工具箱子菜单 |
| `expand-manage` | **v1.25.0** `VaultSidebar` 展开管理子菜单 |
| `collapse-footer-menus` | **v1.25.0** 收起侧栏底部弹出菜单 |
| `expand-tag-filter` | **v1.25.0** `PasswordList` 展开列表工具栏标签筛选 popover |
| `collapse-list-menus` | **v1.25.0** 收起列表工具栏 popover |
| `expand-detail` | `useAppState.expandDetailPanel()` |
| `select-first-entry` | 选中列表首条（详情引导用；无条目时 `fallbackTarget`） |
| `screen` / `settingsTab` | 自动 `navigateTo` / `switchSettingsTab` |

侧栏/列表展开经 `window` 事件 `pwdbook-tour-prepare`（`TOUR_PREPARE_EVENT`）派发；引导进行中 `documentClick` 不关闭 popover。

## 扩展与调试

- 改路径/步骤：编辑 `productTourCatalog.ts`，勿在 overlay 硬编码业务逻辑。
- 卡片定位异常：检查目标是否**全视窗级**（应设 `highlight: 'columns' | 'backdrop'` 或 `cardPlacement: 'center'`）。
- 清除完成标记：删除 `localStorage` 中 `pwdbook-tour-done-*` 键。
- 引导仅主窗口；详情小窗口无学士帽入口。
