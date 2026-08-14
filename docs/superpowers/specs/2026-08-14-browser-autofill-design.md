# 浏览器扩展自动填充

日期：2026-08-14  
状态：已确认  
范围：`extension/content.js` 的填充触发时机；不改桥接协议、Native Host、匹配规则。

## 问题

填充能力已存在，但只有点击「填充」才会调用 `fillOne`。

- 匹配到站点后，`scan()` → `createUi()` 只画填充条，不写表单。
- 多账号下拉只更新 `selectedId`，不填充。
- `fillOne` 成功后调用 `removeUi()`，条消失，无法再换账号。

## 目标

1. 识别到登录框且有匹配条目时，自动填充当前选中账号。
2. 下拉切换账号后，立刻用新账号覆盖填充。
3. 「填充」按钮保留，作为自动填失败或字段晚出现时的补救。
4. 填充成功后填充条留在页面，便于再换账号。

## 非目标

- 不新增 `chrome.storage` 权限，不在页面再存一份「上次账号」。
- 不改 `matchLogins` / `getCredential` 协议。
- 不改 URL 匹配、字段探测、`fillInput` 的写入方式。
- 不做「仅空字段才填」；自动填与换账号一律覆盖已有内容。

## 上次账号

桥接已按 `last_used_at` 降序返回匹配列表；`getCredential` 成功后会 `touchEntry`。

因此默认选中并自动填充 `matches[0]` 即为该站点上次用过的账号。从未通过扩展填充过时，退回保险库已有的 `last_used_at` 排序第一项。

## 行为

| 场景 | 行为 |
|------|------|
| 首次画出填充条（匹配签名变化或条不存在） | 用当前选中项（默认 `matches[0]`）自动 `fillOne` |
| `MutationObserver` 再次扫描，匹配签名未变且条仍在 | 不重复自动填 |
| 下拉选中另一账号 | 更新选中项，立刻 `fillOne`，覆盖已有内容 |
| 点击「填充」 | `fillOne` 当前选中项（单账号时即唯一条目） |
| `getCredential` 失败 | 保持现有 `alert`，条不消失 |
| 当时找不到可见密码框 | 静默返回，条不消失 |
| 页面不再有密码框或匹配为空 | 与现在一样拆掉填充条 |

## 数据流

```
scan → matchLogins → createUi
  → 自动 fillOne(selectedId)     // 仅在新建/重建条时
  → getCredential → fillInput    // 覆盖 username / password
  → touchEntry                   // 下次 matches[0] 即此项

下拉换账号 / 点击「填充」 → 同一条 fillOne
```

`fillOne` 成功后不再调用 `removeUi()`。

## 实现要点

改动集中在 `extension/content.js`：

1. 从 `fillOne` 去掉成功后的 `removeUi()`。
2. 下拉 `click` 在更新 `selectedId` 后立刻 `fillOne`。
3. `createUi` 在条挂到页面后触发一次自动填充；用「已对当前匹配签名自动填过」的标记，避免扫描抖动重复出密。`removeUi()` 须同时清掉该标记，避免表单消失再出现时不再自动填。
4. 单账号与多账号共用同一套 `fillOne`；「填充」按钮仍绑定它。

为便于测试，把「是否应自动填」抽成纯函数，例如：

```
shouldAutoFill({ signature, lastAutoFilledSignature, uiExists })
```

- 签名变化，或条不存在：应自动填。
- 签名相同且条仍在：不应自动填。

## 错误处理

- 凭证失败：`alert` 现有错误文案，条保留，用户可再点「填充」。
- 无密码框：不 alert，条保留。
- 桥接未连接 / 未解锁：`scan` 仍按现有逻辑拆条，不自动填。

## 测试

覆盖抽取出的触发条件：

- 新签名 → 自动填。
- 同签名且条仍在 → 不自动填。
- 换账号是显式 `fillOne`，不受自动填标记拦截。

不在本次引入浏览器端到端测试。

## 文档

实现后更新 `docs/code-map/browser-autofill.md` 填充条交互表：自动填充、换账号即填、填完不拆条。
