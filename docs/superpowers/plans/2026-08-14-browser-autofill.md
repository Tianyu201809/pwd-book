# 浏览器扩展自动填充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登录页匹配到条目后自动填充，切换账号后立刻覆盖填充，并保留「填充」按钮与填充条。

**Architecture:** 把「是否应自动填」抽成 `src/shared/browserAutofillPolicy.ts` 的纯函数并用 Vitest 锁住规则。`extension/content.js` 内放一份相同实现（content script 不能 import `src/`），在新建填充条时调用一次 `fillOne`；下拉换账号也走 `fillOne`；成功后不再 `removeUi()`。上次账号继续依赖桥接已有的 `last_used_at` 排序，默认填 `matches[0]`。

**Tech Stack:** TypeScript + Vitest（策略函数）；MV3 content script（`extension/content.js` 纯 JS）。

## Global Constraints

- 不新增 `chrome.storage` 权限，不在页面再存一份「上次账号」。
- 不改 `matchLogins` / `getCredential` 协议。
- 不改 URL 匹配、字段探测、`fillInput` 的写入方式。
- 自动填与换账号一律覆盖已有内容（`fillInput` 已是覆盖写入）。
- 不引入浏览器端到端测试。
- `content.js` 里的 `shouldAutoFill` 函数体必须与 `src/shared/browserAutofillPolicy.ts` 的逻辑一致。

---

## File Structure

| 文件 | 职责 |
|------|------|
| Create: `src/shared/browserAutofillPolicy.ts` | `shouldAutoFill` 策略：何时自动填、何时跳过 |
| Create: `src/shared/browserAutofillPolicy.test.ts` | 锁住新签名 / 同签名 / 条不存在 / 空签名 |
| Modify: `extension/content.js` | 自动填、换账号即填、填完不拆条、`removeUi` 清标记 |
| Modify: `docs/code-map/browser-autofill.md` | 填充条交互表补上自动填与换账号 |

不改 `extension/manifest.json`、`background.js`、桥接服务。

---

### Task 1: `shouldAutoFill` 策略函数

**Files:**
- Create: `src/shared/browserAutofillPolicy.ts`
- Test: `src/shared/browserAutofillPolicy.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `shouldAutoFill(input: AutoFillDecisionInput): boolean`，其中 `AutoFillDecisionInput` 为 `{ signature: string; lastAutoFilledSignature: string; uiExists: boolean }`

- [ ] **Step 1: Write the failing test**

创建 `src/shared/browserAutofillPolicy.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { shouldAutoFill } from './browserAutofillPolicy'

describe('shouldAutoFill', () => {
  it('auto-fills when the match signature is new', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: '',
        uiExists: true,
      }),
    ).toBe(true)
  })

  it('skips when the same signature was already auto-filled and the bar exists', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: 'entry-a',
        uiExists: true,
      }),
    ).toBe(false)
  })

  it('auto-fills when the bar is gone even if the signature matches the last mark', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: 'entry-a',
        uiExists: false,
      }),
    ).toBe(true)
  })

  it('does not auto-fill an empty signature', () => {
    expect(
      shouldAutoFill({
        signature: '',
        lastAutoFilledSignature: '',
        uiExists: false,
      }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/browserAutofillPolicy.test.ts`

Expected: FAIL，报错无法解析 `./browserAutofillPolicy`（文件尚不存在）。

- [ ] **Step 3: Write minimal implementation**

创建 `src/shared/browserAutofillPolicy.ts`：

```ts
export type AutoFillDecisionInput = {
  signature: string
  lastAutoFilledSignature: string
  uiExists: boolean
}

export function shouldAutoFill(input: AutoFillDecisionInput): boolean {
  if (!input.signature) return false
  if (!input.uiExists) return true
  return input.signature !== input.lastAutoFilledSignature
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/browserAutofillPolicy.test.ts`

Expected: PASS，4 tests。

- [ ] **Step 5: Commit**

```bash
git add src/shared/browserAutofillPolicy.ts src/shared/browserAutofillPolicy.test.ts
git commit -m "feat: 抽出浏览器自动填充触发策略"
```

---

### Task 2: content script 自动填充与换账号即填

**Files:**
- Modify: `extension/content.js`

**Interfaces:**
- Consumes: `shouldAutoFill({ signature, lastAutoFilledSignature, uiExists })`（与 Task 1 同语义；因 content script 不能 import `src/`，在本文件内放一份相同函数体）
- Produces: `fillOne(entryId)` 成功后不拆条；`removeUi()` 同时清空 `lastMatchSignature` 与 `lastAutoFilledSignature`；新建条时自动 `fillOne(selectedId)`；下拉换账号立刻 `fillOne`

- [ ] **Step 1: 在 `content.js` 增加与 Task 1 一致的 `shouldAutoFill` 和自动填标记**

在 `let scanTimer = null` / `let lastMatchSignature = ''` 旁增加标记，并加入与 `browserAutofillPolicy.ts` 相同的函数（不要改函数体）：

```js
let scanTimer = null
let lastMatchSignature = ''
let lastAutoFilledSignature = ''

function shouldAutoFill({ signature, lastAutoFilledSignature, uiExists }) {
  if (!signature) return false
  if (!uiExists) return true
  return signature !== lastAutoFilledSignature
}
```

把 `removeUi` 改成同时清两个标记：

```js
function removeUi() {
  document.getElementById(ROOT_ID)?.remove()
  lastMatchSignature = ''
  lastAutoFilledSignature = ''
}
```

- [ ] **Step 2: `fillOne` 成功后不再拆条**

在 `createUi` 内的 `fillOne` 中删除成功路径末尾的 `removeUi()`。改完后函数为：

```js
  const fillOne = async (entryId) => {
    const res = await chrome.runtime.sendMessage({
      action: 'getCredential',
      entryId,
      pageUrl,
    })
    if (!res?.ok) {
      alert(res?.error || 'Fill failed')
      return
    }
    const pwd = findPasswordField()
    if (!pwd) return
    const user = findUsernameField(pwd)
    fillInput(user, res.data.username)
    fillInput(pwd, res.data.password)
  }
```

凭证失败仍 `alert` 且不拆条；找不到密码框仍静默返回且不拆条。`fillInput` 不要改。

- [ ] **Step 3: 统一 `selectedId`，换账号立刻填，新建条后自动填**

把 `createUi` 里单账号 / 多账号分支改成共用 `let selectedId = matches[0].id`。

单账号按钮：

```js
    actions.appendChild(
      createPrimaryButton(`填充 · ${label}`, () => void fillOne(selectedId)),
    )
```

多账号下拉 `click` 在更新选中项后立刻填充（不要只改标签）：

```js
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        selectedId = m.id
        toggleLabel.textContent = formatMatchTitle(m)
        menu.hidden = true
        picker.classList.remove('is-open')
        void fillOne(selectedId)
      })
```

多账号「填充」按钮仍为：

```js
      createPrimaryButton('填充', () => {
        if (selectedId) void fillOne(selectedId)
      }),
```

在 `document.documentElement.appendChild(root)`、`applyUiPreferences`、`syncCollapseButton`、`clampUiPosition` **之后**增加一次自动填。必须先挂条再判断，这样 `uiExists` 为 true；`removeUi()` 刚清过标记时 `lastAutoFilledSignature` 为空，新签名会自动填。同签名且条仍在时，函数开头的

```js
  if (signature === lastMatchSignature && document.getElementById(ROOT_ID)) {
    return
  }
```

会直接返回，不会走到这里，因此 MutationObserver 抖动不会重复出密。

```js
  document.documentElement.appendChild(root)
  applyUiPreferences(root)
  const collapseBtn = root.querySelector('.pwdbook-collapse-btn')
  if (collapseBtn) syncCollapseButton(root, collapseBtn)
  clampUiPosition(root)

  if (
    shouldAutoFill({
      signature,
      lastAutoFilledSignature,
      uiExists: Boolean(document.getElementById(ROOT_ID)),
    })
  ) {
    lastAutoFilledSignature = signature
    void fillOne(selectedId)
  }
}
```

`lastAutoFilledSignature` 在**尝试**自动填时写入，而不是等成功。这样 `getCredential` 失败不会在每次 DOM 抖动时反复 `alert`。用户仍可点「填充」重试。换账号走显式 `fillOne`，不读这个标记。

- [ ] **Step 4: 对照检查**

打开 `extension/content.js`，确认：

1. `fillOne` 成功路径没有 `removeUi()`。
2. `removeUi` 清空 `lastAutoFilledSignature`。
3. 下拉 `click` 里有 `void fillOne(selectedId)`。
4. 「填充」按钮仍在（单账号为 `填充 · ${label}`，多账号为 `填充`）。
5. `shouldAutoFill` 函数体与 `src/shared/browserAutofillPolicy.ts` 一致。
6. 没有改 `fillInput`、`findPasswordField`、`manifest.json`。

- [ ] **Step 5: 跑策略测试，确认没有误伤**

Run: `npx vitest run src/shared/browserAutofillPolicy.test.ts`

Expected: PASS，4 tests。

- [ ] **Step 6: Commit**

```bash
git add extension/content.js
git commit -m "feat: 浏览器扩展匹配后自动填充并支持换账号即填"
```

---

### Task 3: 更新 code-map 文档

**Files:**
- Modify: `docs/code-map/browser-autofill.md`

**Interfaces:**
- Consumes: Task 2 的实际行为
- Produces: 填充条交互表包含自动填、换账号即填、填完不拆条

- [ ] **Step 1: 更新扩展文件说明与交互表**

把 `content.js` 那一行改成（保留既有版本注记，并补上本次行为）：

```
| `content.js` | 检测表单、PwdBook 填充条、自定义账号下拉（避免原生 select 触发 MutationObserver 重建）；**v1.15.0** 填充条拖拽与收起；**v1.17.0** `isVisibleFillInput`、受控输入框 `value` setter；匹配后自动填充，切换账号立刻覆盖，填充成功后不拆条 |
```

在「填充条 UI」交互表中追加三行（不要删拖拽 / 收起 / 持久化）：

```
| **自动填充** | 填充条首次出现（匹配签名变化，或条被拆掉后重建）时，用当前选中项（默认 `matches[0]`，即 `last_used_at` 最新）调用 `getCredential` 并覆盖写入用户名/密码 |
| **切换账号** | 下拉选中另一条目后立刻填充并覆盖；不必再点「填充」 |
| **填充按钮** | 保留为补救：自动填失败或密码框晚出现时可再点；成功后条留在页面 |
```

- [ ] **Step 2: Commit**

```bash
git add docs/code-map/browser-autofill.md
git commit -m "docs: 补充浏览器扩展自动填充与换账号行为"
```

---

## 手工验收（实现后由执行者在浏览器做）

修改 content script 后须在 `chrome://extensions` **重新加载**扩展。保险库解锁，打开有匹配条目的登录页：

1. 单账号：条出现后用户名/密码被自动填上，条仍在，「填充 · 标题」仍可再点。
2. 多账号：条出现后填的是列表第一项（上次用过的）；下拉换另一项后字段立刻变成新账号。
3. 点「填充」仍能再填当前选中项。
4. 自动填失败（例如先锁保险库再刷新）会 `alert`，条不消失。
5. 页面 DOM 抖动（折叠菜单等）不会反复弹 `alert` 或反复出密。
