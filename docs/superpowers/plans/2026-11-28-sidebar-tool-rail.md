# 侧栏工具轨道实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将保险库侧栏底部四个工具入口改为上/下分组的垂直工具轨道。

**Architecture:** 在 `VaultSidebar.vue` 中保留既有入口和菜单行为，将窄轨道放在侧栏最左侧，分类内容紧随其右。菜单定位于轨道右侧，并确保不被侧栏内容裁切。

**Tech Stack:** Vue 3、TypeScript、Scoped CSS、Vitest 项目脚本。

**Spec:** `docs/superpowers/specs/2026-11-28-sidebar-tool-rail-design.md`

## Global Constraints

- 工具轨道宽约 52px。
- 工具轨道在分类区域左侧，位于整个侧栏最左边。
- 工具、管理位于顶部，回收站、设置贴近底部。
- 保留现有入口行为、菜单、徽标、导览选择器、主题适配和折叠行为。
- 菜单从轨道右侧展开。

## Review Focus

- 工具菜单、管理菜单：点击入口仍只展开对应菜单，菜单锚定轨道右侧。
- 回收站徽标：数量大于 99 时仍显示 `99+`。
- 侧栏折叠：工具轨道仍按现状隐藏，展开后恢复。
- 不同主题：沿用现有 token 和入口图标颜色。
- 导览定位：既有 `data-tour` 属性保持不变。

---

### Task 1: 迁移侧栏工具入口

**Files:**
- Modify: `src/components/VaultSidebar.vue`

**Interfaces:**
- Reuse existing menu handlers, translations, data-tour attributes, and reactive vault status.
- Add no new public interfaces or dependencies.

- [x] **Step 1: Move the four existing slots into a vertical rail**

Keep the Toolbox and Manage slots in the top group. Place Trash and Settings in a bottom group separated by flexible space and a divider. Keep all existing button attributes and event handlers.

- [x] **Step 2: Update the rail and popover styles**

Set the rail width to about 52px, align it beside the category content, and anchor toolbox/manage popovers to the rail's right edge. Keep hover/focus tips visible and preserve the existing responsive collapse behavior.

- [x] **Step 3: Run lint and type checking**

Run: `npx eslint src/components/VaultSidebar.vue`
Expected: PASS. Full-repository lint also runs and currently fails on an unrelated unused import in `src/main/db/database.ts`.

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 4: Build the application**

Run: `npm run build`
Expected: PASS.

Full tests: `npm test` → 220 passed, 1 skipped.

Follow-up: moved the rail to the far left per user clarification and hid the trigger tooltip while its menu is expanded.

Follow-up verification: targeted ESLint PASS, typecheck PASS, `npm test` → 220 passed / 1 skipped, build PASS.
