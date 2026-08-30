# 补齐国内品牌图标与首字头像对比度

日期：2026-08-30  
状态：已确认  
范围：为目录中已有、缺文件的国内品牌补彩色 Logo；修复标题首字 / 字母图标浅底白字看不清。不改选择器结构、自动匹配规则、分类白名单。

## 问题

1. 首批品牌目录含一批国内 id，但 dashboard-icons 无图，文件被跳过。选择器「品牌」页和网址匹配因此用不上支付宝、淘宝、抖音等。
2. 未选图标时，标题首字头像在方块布局里使用 `color: #fff` + `rgba(..., 0.12)` 浅底，白字几乎看不见。列表、详情、回收站、快捷条共用 `getAvatarMeta`。

## 目标

1. 为下列 27 个已有 id 补彩色官方 Logo（本地文件，单张 ≤ 500KB）。补上后选择器自动列出，域名匹配自动生效。
2. 标题首字与 A–Z 字母图标在方块 / 列表 / 详情 / 回收站 / 快捷条上对比度足够，一眼能认字。

## 非目标

- 新增品牌 id 或域名。
- 用户上传图标、在线拉 favicon。
- 用单色简标凑数。
- 改 `preset:` 前缀、自动匹配触发条件、分类选择器。
- 改「取标题第几个字」的规则。

## 要补的 27 个 id

`wecom`、`dingtalk`、`alipay`、`unionpay`、`taobao`、`tmall`、`jd`、`pinduoduo`、`meituan`、`eleme`、`douyin`、`kuaishou`、`xiaohongshu`、`zhihu`、`douban`、`netease-music`、`iqiyi`、`tencent-video`、`youku`、`tencent-cloud`、`wps`、`netease-mail`、`tencent-meeting`、`rail12306`、`ctrip`、`didi`、`xiaomi`。

`PRESET_ICONS` 里这些条目的 label、aliases、domains 已存在，不改。

## 收图

扩展 `scripts/fetch-preset-icons.mjs`：对上列 id，在现有 dashboard-icons slug 之后增加备用 URL（Wikimedia Commons 或品牌可再分发的官方图）。

顺序：dashboard-icons → 该 id 的备用 URL。只要彩色 Logo；边长目标 128–256px；`byteLength ≤ 512000`。成功写入 `src/assets/preset-icons/{id}.png`（若来源是更小的彩色 SVG 则写 `.svg` 并同步 `PRESET_ICONS[].file`）。`SOURCES.md` 记录成功地址或 `skipped: no colorful source under 500KB`。

找不到彩色图则继续跳过，不放单色图。已有文件的 id（微信、QQ 等）不重下、不换图。

选择器仍用 `hasPresetIconAsset` 过滤，无需改 UI。

## 首字 / 字母对比度

根因：`.grid-tile-avatar` 写死 `color: #fff`，而 `getAvatarMeta` 只返回极浅的 `rgba` 背景。

`getAvatarMeta` 改为返回：

```
{ text: string; color: string; bg: string }
```

`text` 仍为标题去空白后第一个字符的 `toUpperCase()`，空则 `?`。`color` 为不透明深色；`bg` 为同色浅底（透明度约 0.20–0.24）。色相仍按 `text.charCodeAt(0) % palette.length` 选取，条数可与现在 6 色相近。

调用处一律用返回的 `color` 作字色、`bg` 作背景，去掉方块布局的白字：

- `PasswordList.vue` 方块 `.grid-tile-avatar` 与列表 `.avatar`
- `PasswordDetail.vue` `.avatar-letter`
- `TrashView.vue` 回收站头像
- `QuickBarApp.vue` `.quickbar-avatar-letter`
- `useAppState` 里缓存的 `entry.avatar` 带上 `color` 与 `bg`

A–Z 字母图标（`LetterA`–`LetterZ`）已是深色字 + 浅底。把 `LETTER_ICON_PALETTE` 的 `bg` 透明度从约 0.14 提到约 0.22，字色不变。`CategoryIconView` 继续读 palette，不改结构。

品牌 `preset:` 图不改。

## 错误处理

| 情况 | 行为 |
|------|------|
| 备用源 404 / 超 500KB / 非彩色 | 该 id 跳过，SOURCES 注明 |
| 下载中断 | 脚本重试（沿用现有 3 次）；已成功文件保留 |
| 旧调用仍读 `avatar.color` 当背景 | 实现时同步改完所有调用，禁止只改一半 |

## 测试

- `getAvatarMeta`：空标题 → `?`；同一标题稳定；`color` 不是 `#fff` / `white`；`bg` 含 alpha 或明显浅于 `color`。
- `canRenderDisplayIcon('preset:alipay')` 等：有文件为真，仍缺文件为假（有文件后再锁真值）。
- 新 png/svg 全部 ≤ 512000 字节。
- 现有 `presetIcons.test.ts` 匹配用例保持绿色（本任务不改域名表）。

不加 UI 端到端。

## 文档

- 更新 `src/assets/preset-icons/SOURCES.md`。
- CHANGELOG `[Unreleased]` 记两条：补齐国内品牌图；首字/字母头像对比度。
- README 图标选择段可补半句「国内常用品牌图已尽量补齐」。
- 不升版本号（除非另行要求）。

## 以后可加（不在本期）

新国内品牌（银行、政务等）；为仍 skip 的 id 再找源。
