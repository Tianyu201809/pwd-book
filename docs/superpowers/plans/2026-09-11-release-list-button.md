# 软件发布列表入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置的“关于”页面增加一个按钮，使用现有外链 API 在系统默认浏览器中打开 PwdBook 的 GitHub Releases 页面。

**Architecture:** 复用 `SettingsView.vue` 已有的 `vaultApi.openExternal` 和 `showToast` 错误提示，不新增 IPC 通道或联网服务。固定 Releases URL 由关于页组件持有，主进程继续负责协议校验并调用 Electron `shell.openExternal`。

**Tech Stack:** Vue 3、TypeScript、Electron preload IPC、Vue I18n、Lucide Vue Next、Vitest、vue-tsc、ESLint。

## Global Constraints

- 固定目标地址为 `https://github.com/Tianyu201809/pwd-book/releases`。
- 不新增自动联网、版本检测、更新下载或应用内网页。
- 外链必须复用 `vaultApi.openExternal`，由既有主进程 handler 校验 `http:`/`https:` 协议。
- 按钮必须同时提供中文和英文文案。
- 保持关于页现有卡片布局、设计 token 和键盘可操作性。

---

### Task 1: Add the release list action to the About panel

**Files:**
- Modify: `src/components/SettingsView.vue` (imports, constants, click handler, About panel template, scoped styles)
- Modify: `src/i18n/locales/zh-CN.ts` (`settings` messages)
- Modify: `src/i18n/locales/en.ts` (`settings` messages)

**Interfaces:**
- Consumes: existing `vaultApi.openExternal(url: string): Promise<void>`, `showToast(message: string, type: 'success' | 'error')`, and `parseErrorMessage(error: unknown): string`.
- Produces: a `releaseListUrl` constant containing the exact Releases URL and an `openReleaseList(): Promise<void>` action bound to the About panel button.

- [ ] **Step 1: Add the external-link icon import and fixed URL constant**

In `src/components/SettingsView.vue`, add `ExternalLink` to the `lucide-vue-next` import list and add this constant near the other module-level constants:

```ts
const RELEASE_LIST_URL = 'https://github.com/Tianyu201809/pwd-book/releases'
```

- [ ] **Step 2: Add the click handler with existing error handling**

Add this function in the `<script setup>` section near the other external-opening handlers:

```ts
async function openReleaseList(): Promise<void> {
  try {
    await vaultApi.openExternal(RELEASE_LIST_URL)
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}
```

- [ ] **Step 3: Add localized button labels**

Add the following keys inside the `settings` object in each locale file:

```ts
// src/i18n/locales/zh-CN.ts
releaseList: '软件发布列表',

// src/i18n/locales/en.ts
releaseList: 'Release list',
```

- [ ] **Step 4: Add the About panel button**

Place this button after the existing `.about-desc` paragraph inside `.about-card`:

```vue
<UiButton
  class="release-list-btn"
  variant="secondary"
  @click="openReleaseList"
>
  <ExternalLink :size="16" :stroke-width="1.8" />
  {{ t('settings.releaseList') }}
</UiButton>
```

Use the existing `UiButton` API and keep the icon plus text so the action remains discoverable in both locales.

- [ ] **Step 5: Add scoped layout styles without changing global CSS**

Add the following rules beside the existing About panel styles:

```css
.release-list-btn {
  margin-top: 16px;
}
```

The button must remain inside the existing card and inherit the established component styling.

- [ ] **Step 6: Run focused static checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit with code 0 and report no errors for the modified Vue or locale files.

- [ ] **Step 7: Run the existing test suite**

Run:

```bash
npm test
```

Expected: Vitest completes successfully. No new unit test is added because the repository has no Vue component test harness or `@vue/test-utils`; the behavior is a thin binding to an existing API, and the type/lint checks cover the new template and handler references.

- [ ] **Step 8: Review the final diff and commit**

Run:

```bash
git diff --check
git diff -- src/components/SettingsView.vue src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts
git status --short
```

Confirm the diff contains only the fixed Releases URL, the localized label, the About panel button, its handler, and its local spacing rule. Then commit:

```bash
git add src/components/SettingsView.vue src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts
git commit -m "feat: add github release list link"
```
