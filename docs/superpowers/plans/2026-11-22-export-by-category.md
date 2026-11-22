# 按分类导出交互实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在导出向导中按分类批量选择条目，并继续允许逐条微调。

**Architecture:** 在 `src/shared/exportSelection.ts` 增加纯函数表达分类选择状态及切换行为，组件复用它驱动分类复选框和条目 ID 选择。继续通过现有导出调用传递条目 ID，不修改 IPC 或导出格式。

**Tech Stack:** Vue 3、TypeScript、vue-i18n、Vitest。

**Spec:** `docs/superpowers/specs/2026-11-22-export-by-category.md`

## Global Constraints

- JSON 是含全部条目、分类、便签和附件的完整备份。
- 分类只批量选择条目；最终导出仍由现有选中的条目 ID 决定。
- 不在导出预览中显示密码。
- 简体中文和英文文案保持一致。

## Review Focus

- 部分条目选中时分类复选框必须处于 indeterminate 状态；纯函数测试覆盖部分状态判定。
- 取消一个分类时其他分类的条目选择必须保留；测试使用两个分类验证。
- 切换某分类选中时必须保留原有其他分类选择，并避免重复 ID；测试验证结果和稳定顺序。
- 空分类不可切换；测试验证切换结果不变。
- 搜索结果是列表展示过滤，不能缩小分类切换范围；组件实现应按完整 `entries` 集合调用辅助函数。

---

### Task 1: 分类批量选择状态

**Files:**
- Modify: `src/shared/exportSelection.ts`
- Test: `src/shared/exportSelection.test.ts`

**Interfaces:**
- Produces: `getCategoryEntrySelectionState(entries: PasswordEntry[], selectedEntryIds: readonly string[], categoryId: string): 'none' | 'partial' | 'all'`
- Produces: `toggleCategoryEntrySelection(entries: PasswordEntry[], selectedEntryIds: readonly string[], categoryId: string): string[]`

- [ ] **Step 1: 添加失败测试**
  覆盖全选/未选/部分三态；选中分类添加该分类所有 ID 且不重复；取消分类仅删除该分类 ID；空分类保持 ID 集合不变。
- [ ] **Step 2: 运行聚焦测试确认失败**
  运行 `npm test -- src/shared/exportSelection.test.ts`，预期新增导出函数不存在而失败。
- [ ] **Step 3: 实现纯选择辅助函数**
  分类选择应根据完整条目数组计算；对分类条目按现有条目顺序追加，并保留非目标分类已选 ID 的相对顺序。
- [ ] **Step 4: 运行聚焦测试确认通过**
  运行 `npm test -- src/shared/exportSelection.test.ts`，所有导出选择测试通过。

### Task 2: 导出弹窗分类交互与本地化

**Files:**
- Modify: `src/components/export/ExportDataModal.vue`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: Task 1 的 `getCategoryEntrySelectionState` 与 `toggleCategoryEntrySelection`。
- Consumes: `useAppState().vaultCategories` 和现有 `entries`。

- [ ] **Step 1: 在条目选择工具栏加入分类选择行**
  用分类名、条目数和原生 checkbox 呈现；绑定 checked 与 indeterminate 三态，禁用条目数为零的分类。
- [ ] **Step 2: 接入双向选择**
  分类变化调用纯函数并更新 `selectedEntryIds`；逐条切换沿用现有状态，分类三态由最新条目 ID 计算；分类操作传入完整 `entries`，不受搜索过滤影响。
- [ ] **Step 3: 补齐中英文文案和样式**
  增加简体中文与英文的分类区域标题/辅助说明；沿用现有 token，分类项左对齐并支持窄屏换行。
- [ ] **Step 4: 验证**
  运行 `npm test -- src/shared/exportSelection.test.ts`、`npm run typecheck`、`npm run lint` 与 `npm run build`；确认均通过。

---
