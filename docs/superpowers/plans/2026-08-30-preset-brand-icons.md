# 预设品牌图标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为密码条目预置本地彩色品牌图标，可在选择器「品牌」页选用，并在网址变化且图标为空时按域名自动带上。

**Architecture:** `display_icon` 增写 `preset:{id}`。目录表与匹配逻辑放在 `src/shared/presetIcons.ts`（纯函数，Vitest 覆盖）。图标文件放在 `src/assets/preset-icons/`，用 Vite `import.meta.glob` 解析成本地 URL。条目选择器多一页「品牌」；分类选择器不出现该页。列表等展示位用 `canRenderDisplayIcon` 决定画品牌图还是标题首字。

**Tech Stack:** Vue 3 + TypeScript + Vite `import.meta.glob` + Vitest。图标收集用 Node 脚本从 dashboard-icons 拉取 PNG。

## Global Constraints

- 单文件 ≤ 500KB；彩色官方 Logo；不热链外网。
- 分类选择器不出现品牌页；`categoryService` 白名单不加入 `preset:`。
- 自动匹配只在条目草稿网址**内容变化**且 `displayIcon === ''` 时触发；已选图标不覆盖；点「使用首字母」不因当前网址立刻回填。
- 不改数据库表、同步协议、导入导出格式。
- 不新增用户上传、不按网址覆盖已选图标、不加 UI 端到端测试。
- 品牌页签文案：中文「品牌」、英文 `Brands`。
- `wechat.aliases` 至少包含 `wx`、`weixin`。
- `12306` 的 id 为 `rail12306`。

---

## File Structure

| 文件 | 职责 |
|------|------|
| Create: `src/shared/presetIcons.ts` | 目录表、前缀解析、域名匹配、搜索、可渲染判断、是否应自动填 |
| Create: `src/shared/presetIcons.test.ts` | 锁住前缀、匹配、搜索、自动填条件、可渲染判断 |
| Create: `src/shared/presetIconAssets.ts` | `import.meta.glob` → `getPresetIconUrl` / `hasPresetIconAsset` / `canRenderDisplayIcon` |
| Create: `src/assets/preset-icons/*.{png,svg,webp}` | 本地 Logo 文件 |
| Create: `src/assets/preset-icons/SOURCES.md` | 来源与跳过原因 |
| Create: `scripts/fetch-preset-icons.mjs` | 下载、校验体积、写 SOURCES.md |
| Modify: `src/components/CategoryIconView.vue` | `preset:` 渲染 `<img>` |
| Modify: `src/components/IconPickerModal.vue` | `allowPresets`、「品牌」页、搜索品牌 |
| Modify: `src/components/PasswordDetail.vue` | 传 `allowPresets`、网址变化自动匹配、可渲染判断 |
| Modify: `src/components/PasswordList.vue` | `canRenderDisplayIcon` |
| Modify: `src/components/TrashView.vue` | `canRenderDisplayIcon` |
| Modify: `src/components/QuickBarApp.vue` | `canRenderDisplayIcon` |
| Modify: `src/i18n/locales/zh-CN.ts` | `icons.tabBrands` |
| Modify: `src/i18n/locales/en.ts` | `icons.tabBrands` |
| Modify: `docs/code-map/renderer-ui.md` | 条目展示图标三种取值 |

不改 `categoryService.ts`、同步、导入导出、数据库 schema。

---

### Task 1: 目录表与纯函数

**Files:**
- Create: `src/shared/presetIcons.ts`
- Test: `src/shared/presetIcons.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_ICON_VALUES` from `src/shared/categoryIcons.ts`
- Produces:
  - `PRESET_ICON_PREFIX = 'preset:'`
  - `interface PresetIconDef { id: string; file: string; labelZh: string; labelEn: string; aliases: string[]; domains: string[] }`
  - `PRESET_ICONS: PresetIconDef[]`
  - `isPresetIcon(name: string): boolean`
  - `parsePresetIconId(name: string): string | null`
  - `formatPresetIconId(id: string): string` — 返回 `preset:{id}`
  - `getPresetIconById(id: string): PresetIconDef | undefined`
  - `matchPresetIconByUrl(url: string): string | null` — 命中返回 `preset:{id}`
  - `searchPresetIcons(query: string): PresetIconDef[]`
  - `shouldApplyPresetFromUrl(previousUrl: string, nextUrl: string, displayIcon: string): boolean`
  - `isRenderableDisplayIcon(name: string, hasPresetAsset: (id: string) => boolean): boolean`

- [ ] **Step 1: Write the failing test**

创建 `src/shared/presetIcons.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  PRESET_ICONS,
  formatPresetIconId,
  getPresetIconById,
  isPresetIcon,
  isRenderableDisplayIcon,
  matchPresetIconByUrl,
  parsePresetIconId,
  searchPresetIcons,
  shouldApplyPresetFromUrl,
} from './presetIcons'

describe('preset icon ids', () => {
  it('parses a preset value and rejects lucide or empty names', () => {
    expect(isPresetIcon('preset:github')).toBe(true)
    expect(parsePresetIconId('preset:github')).toBe('github')
    expect(formatPresetIconId('github')).toBe('preset:github')
    expect(isPresetIcon('')).toBe(false)
    expect(isPresetIcon('Mail')).toBe(false)
    expect(parsePresetIconId('Mail')).toBeNull()
    expect(parsePresetIconId('preset:')).toBeNull()
    expect(parsePresetIconId('preset:GitHub')).toBeNull()
  })
})

describe('matchPresetIconByUrl', () => {
  it('returns null for empty or unparseable input', () => {
    expect(matchPresetIconByUrl('')).toBeNull()
    expect(matchPresetIconByUrl('   ')).toBeNull()
    expect(matchPresetIconByUrl('not a url')).toBeNull()
  })

  it('matches without a protocol and strips www', () => {
    expect(matchPresetIconByUrl('github.com')).toBe('preset:github')
    expect(matchPresetIconByUrl('https://www.github.com/foo')).toBe('preset:github')
  })

  it('matches subdomains and prefers the longer domain', () => {
    expect(matchPresetIconByUrl('https://gist.github.com/x')).toBe('preset:github')
    expect(matchPresetIconByUrl('https://mail.google.com')).toBe('preset:gmail')
    expect(matchPresetIconByUrl('https://www.google.com')).toBe('preset:google')
    expect(matchPresetIconByUrl('https://aws.amazon.com')).toBe('preset:aws')
    expect(matchPresetIconByUrl('https://www.amazon.com')).toBe('preset:amazon')
    expect(matchPresetIconByUrl('https://music.163.com')).toBe('preset:netease-music')
    expect(matchPresetIconByUrl('https://mail.163.com')).toBe('preset:netease-mail')
    expect(matchPresetIconByUrl('https://mail.qq.com')).toBe('preset:qqmail')
    expect(matchPresetIconByUrl('https://im.qq.com')).toBe('preset:qq')
  })

  it('returns null when no catalog domain matches', () => {
    expect(matchPresetIconByUrl('https://example.com')).toBeNull()
  })
})

describe('searchPresetIcons', () => {
  it('finds wechat by id, labels, and required aliases', () => {
    const byWx = searchPresetIcons('wx')
    const byWeixin = searchPresetIcons('weixin')
    const byZh = searchPresetIcons('微信')
    const byId = searchPresetIcons('wechat')
    expect(byWx.some((icon) => icon.id === 'wechat')).toBe(true)
    expect(byWeixin.some((icon) => icon.id === 'wechat')).toBe(true)
    expect(byZh.some((icon) => icon.id === 'wechat')).toBe(true)
    expect(byId.some((icon) => icon.id === 'wechat')).toBe(true)
  })

  it('returns the full catalog when the query is empty', () => {
    expect(searchPresetIcons('').length).toBeGreaterThan(50)
    expect(searchPresetIcons('   ').length).toBe(searchPresetIcons('').length)
  })
})

describe('shouldApplyPresetFromUrl', () => {
  it('applies only when the url text changed and the icon is empty', () => {
    expect(shouldApplyPresetFromUrl('', 'https://github.com', '')).toBe(true)
    expect(shouldApplyPresetFromUrl('https://github.com', 'https://github.com', '')).toBe(false)
    expect(shouldApplyPresetFromUrl('', 'https://github.com', 'preset:github')).toBe(false)
    expect(shouldApplyPresetFromUrl('', 'https://github.com', 'Mail')).toBe(false)
  })
})

describe('isRenderableDisplayIcon', () => {
  const hasGithub = (id: string) => id === 'github'

  it('treats lucide and letter icons as renderable', () => {
    expect(isRenderableDisplayIcon('Mail', hasGithub)).toBe(true)
    expect(isRenderableDisplayIcon('LetterA', hasGithub)).toBe(true)
  })

  it('treats empty and unknown presets as not renderable', () => {
    expect(isRenderableDisplayIcon('', hasGithub)).toBe(false)
    expect(isRenderableDisplayIcon('preset:missing', hasGithub)).toBe(false)
    expect(isRenderableDisplayIcon('preset:github', () => false)).toBe(false)
  })

  it('treats a known preset with an asset as renderable', () => {
    expect(isRenderableDisplayIcon('preset:github', hasGithub)).toBe(true)
  })
})

describe('catalog integrity', () => {
  it('uses unique ids and hostname-only domains', () => {
    const ids = PRESET_ICONS.map((icon) => icon.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PRESET_ICONS.some((icon) => icon.id === 'rail12306')).toBe(true)
    for (const icon of PRESET_ICONS) {
      expect(icon.file.startsWith(`${icon.id}.`)).toBe(true)
      for (const domain of icon.domains) {
        expect(domain).not.toMatch(/^www\./)
        expect(domain).not.toMatch(/^https?:/)
        expect(domain).toBe(domain.toLowerCase())
      }
    }
    expect(getPresetIconById('wechat')?.aliases).toEqual(expect.arrayContaining(['wx', 'weixin']))
  })
})
```

`parsePresetIconId` 只接受 `preset:` + 小写字母/数字/连字符（`/^[a-z0-9-]+$/`）。`preset:GitHub` 必须为 `null`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/presetIcons.test.ts`

Expected: FAIL，模块不存在（`Cannot find module './presetIcons'`）。

- [ ] **Step 3: Write minimal implementation**

创建 `src/shared/presetIcons.ts`。目录表必须覆盖规格 `docs/superpowers/specs/2026-08-30-preset-brand-icons-design.md` 里全部 id 与域名；缺合规图是 Task 2 的事，**本任务先把 79 条都写进目录表**。`file` 暂定为 `{id}.png`。

```ts
import { CATEGORY_ICON_VALUES } from './categoryIcons'

export const PRESET_ICON_PREFIX = 'preset:'

export interface PresetIconDef {
  id: string
  file: string
  labelZh: string
  labelEn: string
  aliases: string[]
  domains: string[]
}

function entry(
  id: string,
  labelZh: string,
  labelEn: string,
  domains: string[],
  aliases: string[] = [],
): PresetIconDef {
  return { id, file: `${id}.png`, labelZh, labelEn, aliases, domains }
}

export const PRESET_ICONS: PresetIconDef[] = [
  entry('wechat', '微信', 'WeChat', ['weixin.qq.com', 'wechat.com'], ['wx', 'weixin']),
  entry('wecom', '企业微信', 'WeCom', ['work.weixin.qq.com'], ['wxwork', 'weixin-work']),
  entry('qq', 'QQ', 'QQ', ['im.qq.com', 'qq.com']),
  entry('weibo', '微博', 'Weibo', ['weibo.com', 'weibo.cn']),
  entry('dingtalk', '钉钉', 'DingTalk', ['dingtalk.com'], ['dingding']),
  entry('feishu', '飞书', 'Feishu', ['feishu.cn', 'larksuite.com'], ['lark']),
  entry('discord', 'Discord', 'Discord', ['discord.com', 'discordapp.com']),
  entry('slack', 'Slack', 'Slack', ['slack.com']),
  entry('telegram', 'Telegram', 'Telegram', ['telegram.org', 't.me']),
  entry('whatsapp', 'WhatsApp', 'WhatsApp', ['whatsapp.com']),
  entry('facebook', 'Facebook', 'Facebook', ['facebook.com', 'fb.com']),
  entry('instagram', 'Instagram', 'Instagram', ['instagram.com']),
  entry('x', 'X', 'X', ['x.com', 'twitter.com'], ['twitter']),
  entry('linkedin', 'LinkedIn', 'LinkedIn', ['linkedin.com']),
  entry('line', 'LINE', 'LINE', ['line.me']),
  entry('alipay', '支付宝', 'Alipay', ['alipay.com'], ['zfb']),
  entry('unionpay', '云闪付', 'UnionPay', ['unionpay.com', '95516.com'], ['yunshanfu']),
  entry('paypal', 'PayPal', 'PayPal', ['paypal.com']),
  entry('taobao', '淘宝', 'Taobao', ['taobao.com']),
  entry('tmall', '天猫', 'Tmall', ['tmall.com']),
  entry('jd', '京东', 'JD', ['jd.com'], ['jingdong']),
  entry('pinduoduo', '拼多多', 'Pinduoduo', ['pinduoduo.com', 'yangkeduo.com'], ['pdd']),
  entry('meituan', '美团', 'Meituan', ['meituan.com']),
  entry('eleme', '饿了么', 'Ele.me', ['ele.me'], ['elm']),
  entry('amazon', 'Amazon', 'Amazon', ['amazon.com', 'amazon.cn', 'amazon.co.jp', 'amazon.co.uk', 'amazon.de']),
  entry('ebay', 'eBay', 'eBay', ['ebay.com']),
  entry('douyin', '抖音', 'Douyin', ['douyin.com']),
  entry('kuaishou', '快手', 'Kuaishou', ['kuaishou.com']),
  entry('bilibili', '哔哩哔哩', 'Bilibili', ['bilibili.com', 'b23.tv'], ['bili']),
  entry('xiaohongshu', '小红书', 'Xiaohongshu', ['xiaohongshu.com'], ['xhs', 'red']),
  entry('zhihu', '知乎', 'Zhihu', ['zhihu.com']),
  entry('douban', '豆瓣', 'Douban', ['douban.com']),
  entry('tiktok', 'TikTok', 'TikTok', ['tiktok.com']),
  entry('youtube', 'YouTube', 'YouTube', ['youtube.com', 'youtu.be']),
  entry('netflix', 'Netflix', 'Netflix', ['netflix.com']),
  entry('spotify', 'Spotify', 'Spotify', ['spotify.com']),
  entry('twitch', 'Twitch', 'Twitch', ['twitch.tv']),
  entry('steam', 'Steam', 'Steam', ['steampowered.com', 'steamcommunity.com']),
  entry('netease-music', '网易云音乐', 'NetEase Cloud Music', ['music.163.com'], ['ncm']),
  entry('iqiyi', '爱奇艺', 'iQIYI', ['iqiyi.com']),
  entry('tencent-video', '腾讯视频', 'Tencent Video', ['v.qq.com']),
  entry('youku', '优酷', 'Youku', ['youku.com']),
  entry('github', 'GitHub', 'GitHub', ['github.com'], ['gh']),
  entry('gitlab', 'GitLab', 'GitLab', ['gitlab.com']),
  entry('gitee', 'Gitee', 'Gitee', ['gitee.com']),
  entry('google', 'Google', 'Google', ['google.com', 'google.com.hk']),
  entry('microsoft', 'Microsoft', 'Microsoft', ['microsoft.com', 'live.com', 'office.com'], ['ms']),
  entry('apple', 'Apple', 'Apple', ['apple.com', 'icloud.com']),
  entry('aliyun', '阿里云', 'Aliyun', ['aliyun.com', 'alibabacloud.com']),
  entry('tencent-cloud', '腾讯云', 'Tencent Cloud', ['cloud.tencent.com', 'qcloud.com']),
  entry('aws', 'AWS', 'AWS', ['aws.amazon.com', 'console.aws.amazon.com']),
  entry('azure', 'Azure', 'Azure', ['azure.com', 'portal.azure.com']),
  entry('cloudflare', 'Cloudflare', 'Cloudflare', ['cloudflare.com']),
  entry('vercel', 'Vercel', 'Vercel', ['vercel.com']),
  entry('docker', 'Docker', 'Docker', ['docker.com']),
  entry('npm', 'npm', 'npm', ['npmjs.com']),
  entry('stackoverflow', 'Stack Overflow', 'Stack Overflow', ['stackoverflow.com'], ['so']),
  entry('openai', 'OpenAI', 'OpenAI', ['openai.com', 'chatgpt.com'], ['chatgpt', 'gpt']),
  entry('claude', 'Claude', 'Claude', ['claude.ai', 'anthropic.com'], ['anthropic']),
  entry('cursor', 'Cursor', 'Cursor', ['cursor.com', 'cursor.sh']),
  entry('wps', 'WPS', 'WPS', ['wps.cn', 'kdocs.cn']),
  entry('outlook', 'Outlook', 'Outlook', ['outlook.com', 'outlook.live.com', 'outlook.office.com']),
  entry('gmail', 'Gmail', 'Gmail', ['gmail.com', 'mail.google.com']),
  entry('qqmail', 'QQ 邮箱', 'QQ Mail', ['mail.qq.com', 'exmail.qq.com']),
  entry('netease-mail', '网易邮箱', 'NetEase Mail', ['mail.163.com', '126.com', '163.com', 'yeah.net']),
  entry('zoom', 'Zoom', 'Zoom', ['zoom.us', 'zoom.com']),
  entry('tencent-meeting', '腾讯会议', 'Tencent Meeting', ['meeting.tencent.com', 'voovmeeting.com']),
  entry('dropbox', 'Dropbox', 'Dropbox', ['dropbox.com']),
  entry('notion', 'Notion', 'Notion', ['notion.so', 'notion.com']),
  entry('figma', 'Figma', 'Figma', ['figma.com']),
  entry('adobe', 'Adobe', 'Adobe', ['adobe.com']),
  entry('baidu', '百度', 'Baidu', ['baidu.com']),
  entry('rail12306', '12306', '12306', ['12306.cn'], ['12306']),
  entry('ctrip', '携程', 'Ctrip', ['ctrip.com', 'trip.com']),
  entry('didi', '滴滴', 'DiDi', ['didiglobal.com', 'didi.cn']),
  entry('uber', 'Uber', 'Uber', ['uber.com']),
  entry('airbnb', 'Airbnb', 'Airbnb', ['airbnb.com']),
  entry('huawei', '华为', 'Huawei', ['huawei.com', 'vmall.com']),
  entry('xiaomi', '小米', 'Xiaomi', ['mi.com', 'xiaomi.com']),
]

const PRESET_BY_ID = new Map(PRESET_ICONS.map((icon) => [icon.id, icon]))

export function isPresetIcon(name: string): boolean {
  return parsePresetIconId(name) !== null
}

export function parsePresetIconId(name: string): string | null {
  if (!name.startsWith(PRESET_ICON_PREFIX)) return null
  const id = name.slice(PRESET_ICON_PREFIX.length)
  return /^[a-z0-9-]+$/.test(id) ? id : null
}

export function formatPresetIconId(id: string): string {
  return `${PRESET_ICON_PREFIX}${id}`
}

export function getPresetIconById(id: string): PresetIconDef | undefined {
  return PRESET_BY_ID.get(id)
}

function normalizeHostname(urlText: string): string | null {
  const trimmed = urlText.trim()
  if (!trimmed) return null
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`
  let hostname: string
  try {
    hostname = new URL(candidate).hostname
  } catch {
    return null
  }
  hostname = hostname.toLowerCase().replace(/\.$/, '')
  if (hostname.startsWith('www.')) hostname = hostname.slice(4)
  return hostname || null
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

export function matchPresetIconByUrl(url: string): string | null {
  const hostname = normalizeHostname(url)
  if (!hostname) return null
  let best: { id: string; length: number } | null = null
  for (const icon of PRESET_ICONS) {
    for (const domain of icon.domains) {
      if (!domainMatches(hostname, domain)) continue
      if (!best || domain.length > best.length) {
        best = { id: icon.id, length: domain.length }
      }
    }
  }
  return best ? formatPresetIconId(best.id) : null
}

export function searchPresetIcons(query: string): PresetIconDef[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return PRESET_ICONS
  return PRESET_ICONS.filter((icon) => {
    if (icon.id.includes(keyword)) return true
    if (icon.labelEn.toLowerCase().includes(keyword)) return true
    if (icon.labelZh.toLowerCase().includes(keyword)) return true
    return icon.aliases.some((alias) => alias.toLowerCase().includes(keyword))
  })
}

export function shouldApplyPresetFromUrl(
  previousUrl: string,
  nextUrl: string,
  displayIcon: string,
): boolean {
  return previousUrl !== nextUrl && displayIcon === ''
}

export function isRenderableDisplayIcon(
  name: string,
  hasPresetAsset: (id: string) => boolean,
): boolean {
  if (!name) return false
  if (CATEGORY_ICON_VALUES.includes(name)) return true
  const id = parsePresetIconId(name)
  if (!id || !getPresetIconById(id)) return false
  return hasPresetAsset(id)
}
```

`matchPresetIconByUrl('not a url')`：`https://not a url` 会被 `new URL` 抛错，返回 `null`。不要把无点主机名（如 `github`）当成有效匹配。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/presetIcons.test.ts`

Expected: PASS，全部用例绿色。

- [ ] **Step 5: Commit**

```bash
git add src/shared/presetIcons.ts src/shared/presetIcons.test.ts
git commit -m "feat: add preset brand icon catalog and URL matching"
```

---

### Task 2: 下载图标文件与资源映射

**Files:**
- Create: `scripts/fetch-preset-icons.mjs`
- Create: `src/assets/preset-icons/*.png`（脚本写入）
- Create: `src/assets/preset-icons/SOURCES.md`（脚本写入）
- Create: `src/shared/presetIconAssets.ts`

**Interfaces:**
- Consumes: `PRESET_ICONS` ids（脚本内维护同一份 id → slug 表，必须覆盖 Task 1 全部 79 个 id）
- Produces:
  - `getPresetIconUrl(id: string): string | undefined`
  - `hasPresetIconAsset(id: string): boolean`
  - `canRenderDisplayIcon(name: string): boolean` — 内部调用 `isRenderableDisplayIcon(name, hasPresetIconAsset)`

- [ ] **Step 1: Write the fetch script**

创建 `scripts/fetch-preset-icons.mjs`。主源为 [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) 的 PNG：`https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{slug}.png`。每个 id 按 `slugs` 数组依次尝试，404 试下一个；全部失败则跳过并记入 SOURCES.md。写入前检查 `byteLength <= 512000`。成功文件写到 `src/assets/preset-icons/{id}.png`。

```js
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'src/assets/preset-icons')
const MAX_BYTES = 512_000
const BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png'

const ITEMS = [
  ['wechat', ['wechat']],
  ['wecom', ['wecom', 'wechat-work', 'weixin-work']],
  ['qq', ['qq', 'tencent-qq']],
  ['weibo', ['weibo']],
  ['dingtalk', ['dingtalk', 'dingding']],
  ['feishu', ['feishu', 'lark']],
  ['discord', ['discord']],
  ['slack', ['slack']],
  ['telegram', ['telegram']],
  ['whatsapp', ['whatsapp']],
  ['facebook', ['facebook']],
  ['instagram', ['instagram']],
  ['x', ['x', 'twitter']],
  ['linkedin', ['linkedin']],
  ['line', ['line']],
  ['alipay', ['alipay']],
  ['unionpay', ['unionpay', 'chinapay']],
  ['paypal', ['paypal']],
  ['taobao', ['taobao']],
  ['tmall', ['tmall']],
  ['jd', ['jd', 'jingdong']],
  ['pinduoduo', ['pinduoduo', 'pdd']],
  ['meituan', ['meituan']],
  ['eleme', ['eleme', 'ele-me']],
  ['amazon', ['amazon']],
  ['ebay', ['ebay']],
  ['douyin', ['douyin']],
  ['kuaishou', ['kuaishou']],
  ['bilibili', ['bilibili']],
  ['xiaohongshu', ['xiaohongshu', 'rednote']],
  ['zhihu', ['zhihu']],
  ['douban', ['douban']],
  ['tiktok', ['tiktok']],
  ['youtube', ['youtube']],
  ['netflix', ['netflix']],
  ['spotify', ['spotify']],
  ['twitch', ['twitch']],
  ['steam', ['steam']],
  ['netease-music', ['netease-cloud-music', 'netease-music', 'netease']],
  ['iqiyi', ['iqiyi']],
  ['tencent-video', ['tencent-video', 'tencent']],
  ['youku', ['youku']],
  ['github', ['github']],
  ['gitlab', ['gitlab']],
  ['gitee', ['gitee']],
  ['google', ['google']],
  ['microsoft', ['microsoft']],
  ['apple', ['apple']],
  ['aliyun', ['alibabacloud', 'aliyun']],
  ['tencent-cloud', ['tencent-cloud', 'qcloud']],
  ['aws', ['aws', 'amazon-web-services']],
  ['azure', ['azure', 'microsoft-azure']],
  ['cloudflare', ['cloudflare']],
  ['vercel', ['vercel']],
  ['docker', ['docker']],
  ['npm', ['npm']],
  ['stackoverflow', ['stackoverflow', 'stack-overflow']],
  ['openai', ['openai', 'chatgpt']],
  ['claude', ['claude', 'anthropic']],
  ['cursor', ['cursor']],
  ['wps', ['wps', 'kingsoft']],
  ['outlook', ['outlook', 'microsoft-outlook']],
  ['gmail', ['gmail']],
  ['qqmail', ['qq-mail', 'qq']],
  ['netease-mail', ['netease', '163']],
  ['zoom', ['zoom']],
  ['tencent-meeting', ['tencent-meeting', 'voov']],
  ['dropbox', ['dropbox']],
  ['notion', ['notion']],
  ['figma', ['figma']],
  ['adobe', ['adobe']],
  ['baidu', ['baidu']],
  ['rail12306', ['12306']],
  ['ctrip', ['ctrip', 'trip']],
  ['didi', ['didi']],
  ['uber', ['uber']],
  ['airbnb', ['airbnb']],
  ['huawei', ['huawei']],
  ['xiaomi', ['xiaomi']],
]

async function download(slug) {
  const url = `${BASE}/${slug}.png`
  const response = await fetch(url)
  if (!response.ok) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null
  return { buffer, url, bytes: buffer.byteLength }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const lines = [
    '# Preset icon sources',
    '',
    'Brand marks belong to their owners. Files are bundled only to identify the corresponding site or app.',
    'Primary source: https://github.com/homarr-labs/dashboard-icons (PNG).',
    '',
    '| id | file | bytes | source |',
    '|----|------|------:|--------|',
  ]
  const skipped = []
  for (const [id, slugs] of ITEMS) {
    let found = null
    for (const slug of slugs) {
      found = await download(slug)
      if (found) break
    }
    if (!found) {
      skipped.push(id)
      lines.push(`| ${id} | — | — | skipped: no dashboard-icons PNG under 500KB |`)
      continue
    }
    const file = `${id}.png`
    await writeFile(join(OUT_DIR, file), found.buffer)
    lines.push(`| ${id} | ${file} | ${found.bytes} | ${found.url} |`)
    console.log(`ok ${id} ${found.bytes}B`)
  }
  await writeFile(join(OUT_DIR, 'SOURCES.md'), `${lines.join('\n')}\n`, 'utf8')
  console.log(`skipped ${skipped.length}: ${skipped.join(', ') || '(none)'}`)
  if (ITEMS.length - skipped.length < 40) {
    throw new Error('Too few icons downloaded; check network or slug names')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 2: Run the script**

Run: `node scripts/fetch-preset-icons.mjs`

Expected: 控制台打印多行 `ok {id} {bytes}B`，`src/assets/preset-icons/` 下出现 png 与 `SOURCES.md`。跳过的 id 写在表里。若某条 404，只跳过该条，不要改 Task 1 目录表（选择器靠 glob 有文件才列出）。

若跳过超过一半：先核对 slug（打开 dashboard-icons 仓库 `png/` 目录搜品牌名），把成功的 slug 补进 `ITEMS` 后重跑。不要用运行时 URL。找不到合规源的品牌保持 skipped。

- [ ] **Step 3: Add the Vite asset module**

创建 `src/shared/presetIconAssets.ts`：

```ts
import { getPresetIconById, isRenderableDisplayIcon } from './presetIcons'

const modules = import.meta.glob('../assets/preset-icons/*.{png,svg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const urlByFile = new Map<string, string>()
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop()
  if (file) urlByFile.set(file, url)
}

export function getPresetIconUrl(id: string): string | undefined {
  const icon = getPresetIconById(id)
  if (!icon) return undefined
  return urlByFile.get(icon.file)
}

export function hasPresetIconAsset(id: string): boolean {
  return Boolean(getPresetIconUrl(id))
}

export function canRenderDisplayIcon(name: string): boolean {
  return isRenderableDisplayIcon(name, hasPresetIconAsset)
}
```

若某个成功下载的文件扩展名不是 png，同步改 `PRESET_ICONS` 里对应 `file`。默认保持 `{id}.png`。

- [ ] **Step 4: Confirm downloaded files stay under the size cap**

Run: `node -e "const fs=require('fs');const p='src/assets/preset-icons';for (const f of fs.readdirSync(p)){if(!/\.(png|svg|webp)$/.test(f))continue;const n=fs.statSync(p+'/'+f).size;if(n>512000){console.error(f,n);process.exit(1)}console.log(f,n)}"`

Expected: 每个图片文件打印字节数，全部 ≤ 512000，退出码 0。

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-preset-icons.mjs src/assets/preset-icons src/shared/presetIconAssets.ts src/shared/presetIcons.ts
git commit -m "feat: bundle local preset brand icon assets"
```

---

### Task 3: CategoryIconView 渲染品牌图

**Files:**
- Modify: `src/components/CategoryIconView.vue`

**Interfaces:**
- Consumes: `parsePresetIconId` from `src/shared/presetIcons.ts`；`getPresetIconUrl` from `src/shared/presetIconAssets.ts`
- Produces: `name` 为 `preset:{id}` 且能解析到 URL 时，在圆角徽章内显示 `<img>`；`<img>` `@error` 后改显示默认 Folder

- [ ] **Step 1: Extend CategoryIconView**

把 `<script setup>` 改成：

```ts
import { computed, ref, watch } from 'vue'
import { getCategoryIcon, getCategoryIconMeta, getLetterFromIcon, isLetterIcon } from '@/shared/categoryIcons'
import { parsePresetIconId } from '@/shared/presetIcons'
import { getPresetIconUrl } from '@/shared/presetIconAssets'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    badgeSize?: number
    colored?: boolean
  }>(),
  {
    size: 15,
    badgeSize: 26,
    colored: true,
  },
)

const meta = computed(() => getCategoryIconMeta(props.name))
const Icon = computed(() => getCategoryIcon(props.name))
const letter = computed(() => (isLetterIcon(props.name) ? getLetterFromIcon(props.name) : ''))
const letterFontSize = computed(() => Math.max(10, Math.round(props.size * 0.92)))
const presetUrl = computed(() => {
  const id = parsePresetIconId(props.name)
  return id ? getPresetIconUrl(id) : undefined
})
const presetFailed = ref(false)
watch(presetUrl, () => {
  presetFailed.value = false
})

const badgeStyle = computed(() => {
  if (presetUrl.value && !presetFailed.value) {
    return {
      width: `${props.badgeSize}px`,
      height: `${props.badgeSize}px`,
      background: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
    }
  }
  return {
    width: `${props.badgeSize}px`,
    height: `${props.badgeSize}px`,
    background: meta.value.bg,
    color: meta.value.color,
  }
})
```

模板里，彩色徽章内在字母和 Lucide 之前插入：

```vue
<img
  v-if="presetUrl && !presetFailed"
  :src="presetUrl"
  alt=""
  class="preset-icon"
  @error="presetFailed = true"
>
```

`v-else-if="letter"` 原字母，`v-else` 原 Lucide。`colored === false` 时同样：有 preset 就输出同一张 `<img class="preset-icon">`，否则保持字母/Lucide。

样式：

```css
.preset-icon {
  width: 72%;
  height: 72%;
  object-fit: contain;
  pointer-events: none;
}
```

- [ ] **Step 2: Typecheck the renderer**

Run: `npm run typecheck`

Expected: PASS，无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryIconView.vue
git commit -m "feat: render preset brand images in CategoryIconView"
```

---

### Task 4: 选择器「品牌」页与文案

**Files:**
- Modify: `src/components/IconPickerModal.vue`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `allowPresets?: boolean`（默认 `false`）；`formatPresetIconId`、`isPresetIcon`、`searchPresetIcons`；`hasPresetIconAsset`
- Produces: 仅当 `allowPresets === true` 时出现第三页签「品牌」；选中发出 `preset:{id}`

- [ ] **Step 1: Add locale strings**

在 `src/i18n/locales/zh-CN.ts` 的 `icons` 对象里，`tabLetters` 后加：

```ts
tabBrands: '品牌',
```

在 `src/i18n/locales/en.ts` 的 `icons` 对象里，`tabLetters` 后加：

```ts
tabBrands: 'Brands',
```

- [ ] **Step 2: Update IconPickerModal**

替换 props 与页签逻辑（保留现有搜索框、格子样式、页脚）：

```ts
import { formatPresetIconId, isPresetIcon, searchPresetIcons } from '@/shared/presetIcons'
import { hasPresetIconAsset } from '@/shared/presetIconAssets'

type PickerTab = 'icons' | 'letters' | 'brands'

const props = withDefaults(
  defineProps<{
    selected?: string
    title?: string
    allowClear?: boolean
    allowPresets?: boolean
  }>(),
  {
    allowClear: true,
    allowPresets: false,
    selected: undefined,
    title: undefined,
  },
)
```

`tabItems`：

```ts
const tabItems = computed(() => {
  const items = [
    { key: 'icons' as const, label: t('icons.tabIcons') },
    { key: 'letters' as const, label: t('icons.tabLetters') },
  ]
  if (props.allowPresets) {
    items.push({ key: 'brands' as const, label: t('icons.tabBrands') })
  }
  return items
})
```

打开时：

```ts
watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ''
  if (props.allowPresets && props.selected && isPresetIcon(props.selected)) {
    activeTab.value = 'brands'
    return
  }
  activeTab.value = props.selected && isLetterIcon(props.selected) ? 'letters' : 'icons'
})
```

品牌页数据（无文件的目录项不出现）。`useI18n` 增加 `locale`：

```ts
const { t, locale } = useI18n()

const brandCells = computed(() =>
  searchPresetIcons(query.value)
    .filter((icon) => hasPresetIconAsset(icon.id))
    .map((icon) => ({
      value: formatPresetIconId(icon.id),
      label: String(locale.value).startsWith('zh') ? icon.labelZh : icon.labelEn,
      color: '#64748b',
      bg: 'transparent',
    })),
)
```

`filteredIcons`：

```ts
const filteredIcons = computed(() => {
  if (activeTab.value === 'brands') return brandCells.value
  const source = activeTab.value === 'letters' ? LETTER_ICON_OPTIONS : BASE_CATEGORY_ICON_OPTIONS
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return source
  return source.filter(
    (icon) =>
      translateIconLabel(icon.value).toLowerCase().includes(keyword) ||
      icon.value.toLowerCase().includes(keyword),
  )
})
```

格子 `title`：品牌用 `icon.label`（`v-for="icon in filteredIcons"` 时 brands 的 `label` 已是中英文名；Lucide/字母仍用 `translateIconLabel(icon.value)`）。实现：

```ts
function cellTitle(icon: { value: string; label?: string }): string {
  if (activeTab.value === 'brands' && icon.label) return icon.label
  return translateIconLabel(icon.value)
}
```

模板 `:title="cellTitle(icon)"`。`CategoryManagePanel` 两处 `IconPickerModal` **不要**传 `allow-presets`（默认 false）。

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/components/IconPickerModal.vue src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts
git commit -m "feat: add Brands tab to entry icon picker"
```

---

### Task 5: 条目编辑自动匹配

**Files:**
- Modify: `src/components/PasswordDetail.vue`

**Interfaces:**
- Consumes: `matchPresetIconByUrl`、`shouldApplyPresetFromUrl`、`canRenderDisplayIcon`
- Produces: 可编辑且非回填草稿时，网址变化且图标为空则写入匹配到的 `preset:{id}`；选择器 `allow-presets`

- [ ] **Step 1: Wire auto-match and the picker flag**

在 `src/components/PasswordDetail.vue` 增加 import：

```ts
import { matchPresetIconByUrl, shouldApplyPresetFromUrl } from '@/shared/presetIcons'
import { canRenderDisplayIcon } from '@/shared/presetIconAssets'
```

在 `resetDraftFromEntry` 里用回填标记，避免切条目时误触发：

```ts
const hydratingDraft = ref(false)

function resetDraftFromEntry(): void {
  hydratingDraft.value = true
  // 保持函数体内现有赋值不变
  void nextTick(() => {
    hydratingDraft.value = false
  })
}
```

`resetDraftFromEntry` 现有的 `draft.value = { ... }` 不要改字段，只包上 `hydratingDraft`。

增加 watch（与现有 watch 并列）：

```ts
watch(
  () => draft.value.url,
  (next, prev) => {
    if (hydratingDraft.value || !formEditable.value) return
    if (!shouldApplyPresetFromUrl(prev ?? '', next, draft.value.displayIcon)) return
    const matched = matchPresetIconByUrl(next)
    if (matched) draft.value.displayIcon = matched
  },
)
```

头像 `v-if` 从 `draft.displayIcon` 改为 `canRenderDisplayIcon(draft.displayIcon)`：

```vue
<CategoryIconView
  v-if="canRenderDisplayIcon(draft.displayIcon)"
  :name="draft.displayIcon"
  :badge-size="48"
  :size="22"
/>
```

`IconPickerModal` 增加：

```vue
<IconPickerModal
  v-model:open="showIconPicker"
  :selected="draft.displayIcon"
  :allow-presets="true"
  @select="handleIconSelect"
  @clear="handleIconClear"
/>
```

`handleIconClear` 保持 `draft.value.displayIcon = ''`，不要在 clear 里调用 `matchPresetIconByUrl`。

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/components/PasswordDetail.vue
git commit -m "feat: auto-apply preset icons from entry URLs"
```

---

### Task 6: 列表展示与 code-map

**Files:**
- Modify: `src/components/PasswordList.vue`
- Modify: `src/components/TrashView.vue`
- Modify: `src/components/QuickBarApp.vue`
- Modify: `docs/code-map/renderer-ui.md`

**Interfaces:**
- Consumes: `canRenderDisplayIcon(name: string): boolean`
- Produces: 四处展示与详情头像同一套「可渲染才画 CategoryIconView」规则；文档写明三种 `display_icon`

- [ ] **Step 1: Switch render guards**

`PasswordList.vue` 两处（约 grid 435 行、list 509 行）：

```ts
import { canRenderDisplayIcon } from '@/shared/presetIconAssets'
```

```vue
<CategoryIconView
  v-if="canRenderDisplayIcon(entry.displayIcon)"
  :name="entry.displayIcon"
```

`TrashView.vue`（约 211 行）与 `QuickBarApp.vue`（约 267 行）同样：import `canRenderDisplayIcon`，把 `v-if="entry.displayIcon"` 换成 `v-if="canRenderDisplayIcon(entry.displayIcon)"`。

- [ ] **Step 2: Update renderer code-map**

在 `docs/code-map/renderer-ui.md` 的 `IconPickerModal.vue` 那一行改为：

```
├── IconPickerModal.vue       # 条目/分类图标选择（图标/字母；条目另有品牌页）
```

在同文件 `PasswordDetail.vue` 说明附近（组件树之后、DetailWindow 之前）加一节：

```md
### 条目展示图标 `display_icon`

| 值 | 界面 |
|----|------|
| `""` | 条目标题首字 |
| Lucide 名 / `LetterA`–`LetterZ` | `CategoryIconView` |
| `preset:{id}` | 本地 `src/assets/preset-icons/` 彩色 Logo；目录见 `src/shared/presetIcons.ts` |

条目选择器可开「品牌」页（`allowPresets`）。分类选择器不传该开关。网址在编辑草稿中变化且图标为空时，`matchPresetIconByUrl` 写入对应 `preset:{id}`。未知 id 或文件缺失时 `canRenderDisplayIcon` 为假，退回标题首字。
```

- [ ] **Step 3: Run unit tests and typecheck**

Run: `npx vitest run src/shared/presetIcons.test.ts`

Expected: PASS。

Run: `npm run typecheck`

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/components/PasswordList.vue src/components/TrashView.vue src/components/QuickBarApp.vue docs/code-map/renderer-ui.md
git commit -m "feat: show preset brand icons in lists and document display_icon"
```

---

## Manual verification (after Task 6)

1. `npm run dev`，新建条目，网址填 `github.com`，头像应变为 GitHub 图。
2. 点头像打开选择器，应有「品牌」页；搜 `微信` / `wx` 能看到微信。
3. 选一个品牌后改网址，图标不变。
4. 点「使用标题首字母」，图标变首字，且不会马上变回品牌图；再改网址才重新匹配。
5. 打开分类管理选择器，没有「品牌」页。
6. 列表、方块布局、回收站、快捷条对已选品牌图显示同一张图。
