# 折叠面板动效实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为左侧分类栏与右侧详情栏增加一致、可中断且支持减少动态效果的展开/收起动画。

**Architecture:** 新增 `PanelContentMotion.vue` 提供固定宽度的内容裁剪视口，并用 composable 持有 GSAP matchMedia 监听和 Transition hooks。面板外壳与折叠边缘共享 280ms easing，两个面板内容从相反方向进入。

**Tech Stack:** Vue 3、GSAP 3、TypeScript。

**Spec:** `docs/superpowers/specs/2026-11-22-panel-collapse-motion.md`

## Global Constraints

- GSAP 只处理面板内容的透明度、短距离位移和轻微缩放。
- 左右面板分别从左侧、右侧进入，收起时向面板内侧退回。
- `prefers-reduced-motion: reduce` 时过渡立即完成。
- 页面初始渲染不播放入场动画，宽度拖动不触发内容过渡。

## Review Focus

- 快速反向切换时旧 tween 必须取消并清理样式，避免面板内容卡在中间状态。
- 系统减少动态效果偏好必须让新过渡立即完成。
- Node 测试环境缺少 `window.matchMedia` 时 composable 必须可安全挂载。
- Vue Transition 初次挂载时不得触发入场动画。
- 手动宽度拖动仍由原 CSS 逻辑处理，不得被 GSAP 覆盖。

---

### Task 1: 共享面板内容动效

**Files:**
- Create: `src/composables/usePanelContentMotion.ts`
- Create: `src/components/PanelContentMotion.vue`
- Modify: `src/components/VaultSidebar.vue`
- Modify: `src/components/PasswordDetail.vue`
- Modify: `src/components/PanelEdge.vue`

**Interfaces:**
- Produces: `usePanelContentMotion(entrySide: 'left' | 'right')` returning Vue Transition hooks `onEnter(element, done)`, `onLeave(element, done)`, `onEnterCancelled(element)`, and `onAfterLeave(element)`.
- Produces: `PanelContentMotion.vue` accepting `side`, `collapsed`, optional `fill`, and rendering a clipped fixed-width slot viewport.
- Consumes: GSAP `matchMedia`, `fromTo`, `to`, `set`, and `killTweensOf`.

- [ ] **Step 1: 实现共享 Transition hooks**
  增加 reduced-motion 查询、左右进入方向、展开轻微回弹、收起淡出，并管理活动 tween 与取消时样式清理。无 `window.matchMedia` 时直接使用普通动效路径。
- [ ] **Step 2: 接入可裁剪面板内容**
  用 `PanelContentMotion.vue` 包住两个面板内容并将 slot 子项绝对定位到展开宽度；折叠时设 `inert`，右侧 detached 窗口传 `fill`。
- [ ] **Step 3: 统一外壳宽度过渡**
  左右外壳移除同步变化的 `max-width` 和 `flex-basis`，与 `PanelEdge` 使用 280ms 的 `cubic-bezier(0.22, 1, 0.36, 1)`；减少动态效果时关闭 CSS transition。
- [ ] **Step 4: 验证**
  运行 `npm test`、对所有改动的 TypeScript/Vue 文件运行 ESLint、`npm run typecheck` 和 `npm run build`；在隔离 Electron 窗口验证两边展开、收起、中断重开及减少动态效果。

---
