# 预设品牌图标

日期：2026-08-30  
状态：已确认  
范围：条目展示图标增加本地品牌图库与网址自动匹配；分类图标不变。

## 问题

条目选择器只有 Lucide 通用图标和字母头像。常见网站/软件（微信、GitHub、支付宝）无法用品牌图辨认。应用默认离线，不能运行时去拉 favicon。

## 目标

1. 随安装包预置约 60–80 个中外常用网站/软件的彩色官方 Logo，单文件不超过 500KB。
2. 编辑条目时，可在选择器「品牌」页搜索并选用这些图标。
3. 填写网址且尚未选择图标时，按域名自动带上对应品牌图标；已选图标不覆盖。
4. 列表、详情、快捷条、回收站用同一套本地图渲染。同步与导入导出只多传一个字符串 ID。

## 非目标

- 用户自行上传图标。
- 分类选择器出现品牌图。
- 按网址自动覆盖已经选过的图标。
- 运行时向网络请求 favicon 或 Logo。
- 改数据库表结构、同步协议或导入导出格式。

## 数据模型

`password_entries.display_icon` 继续存字符串，多一种前缀：

| 值 | 含义 |
|----|------|
| `""` | 用条目标题首字当头像 |
| `Mail`、`LetterA` 等 | 现有 Lucide / 字母 |
| `preset:github` | 本地品牌图，id 为 `github` |

前缀固定为 `preset:`，后面是目录表 `id`（小写字母、数字、连字符）。不存文件路径、不存 URL。

分类的 `icon` 仍只允许现有 Lucide / 字母集合。`categoryService` 的白名单不加入 `preset:`。

旧版本或已删除的 id：字符串照常同步；本机渲染时若目录表没有该 id 或文件缺失，视为不可渲染，界面退回标题首字。

## 文件与目录表

图标文件：`src/assets/preset-icons/{id}.{png|svg|webp}`

约束：

- 彩色官方 Logo（能认品牌，不统一成单色简标）。
- 单文件 ≤ 500KB；目标边长 128–256px，实际体积宜为数十 KB。
- 优先 PNG；若来源是彩色 SVG 且体积更小，可用 SVG。
- 收集不到合规来源的品牌，从首批名单中去掉，不硬凑、不热链外网。

目录表：`src/shared/presetIcons.ts`（或同级拆出的数据模块）。每条：

```
id: string
file: string          // 文件名，含扩展名
labelZh: string
labelEn: string
aliases: string[]     // 搜索用，可空
domains: string[]     // 自动匹配用，主机名，无协议、无 www、小写
```

用 Vite `import.meta.glob` 把 `src/assets/preset-icons/*` 映射成打包后的本地 URL。渲染只读这个映射，不走 `file://`、不走自定义协议。

仓库内 `src/assets/preset-icons/SOURCES.md` 记录每张图的来源。商标归各品牌，仅用于辨认对应网站/软件。

## 组件与调用关系

```
条目编辑
  PasswordDetail
    → 网址变化且 displayIcon 为空 → matchPresetIconByUrl
    → IconPickerModal(allowPresets=true)  多「品牌」页

分类管理
  CategoryManagePanel
    → IconPickerModal(allowPresets=false)  仅「图标 / 字母」

展示
  PasswordList / PasswordDetail / TrashView / QuickBarApp
    → 可渲染则 CategoryIconView(name)
    → 否则标题首字
```

`IconPickerModal` 增加 `allowPresets`（默认 `false`）。仅 `PasswordDetail` 传 `true`。

`CategoryIconView` 识别 `preset:`：查到本地 URL 则在现有圆角徽章里用 `<img>`（`object-fit: contain`，四周留少量内边距）；否则走现有 Lucide / 字母逻辑。

父级用 `isRenderableDisplayIcon(name)`：Lucide、字母、以及目录表有条目且 glob 得到文件的 `preset:` 为真；空字符串、未知 `preset:`、文件不在映射里为假。为假时父级画标题首字，不把该 name 传给 `CategoryIconView`。

`<img>` 运行时加载失败时，`CategoryIconView` 退回默认 Folder 图标（与未知 Lucide 名一致）。

中英文案：品牌页签为「品牌」/ `Brands`；图标无匹配时沿用现有 `icons.noMatch`。

## 选择器行为

条目选择器三个页签：图标、字母、品牌。品牌页平铺格子，不按分类分块。

搜索（不区分大小写）匹配 `id`、`labelZh`、`labelEn`、`aliases`。例如 `wx`、`微信`、`wechat` 都能找到微信（`wechat.aliases` 至少包含 `wx`、`weixin`）。其余品牌按常用简称写入 `aliases`，在目录表中写死，不在运行时再猜。

选中写入 `preset:{id}` 并关弹层。页脚「使用首字母」清空 `displayIcon`（与现在一致）。

分类选择器不出现「品牌」页，也不能靠粘贴写入 `preset:`。

## 网址自动匹配

纯函数 `matchPresetIconByUrl(url: string): string | null`，返回 `preset:{id}` 或 `null`。

规范化：

1. 去掉首尾空白；空字符串 → `null`。
2. 无协议则先按 `https://` 解析。
3. 取出 hostname，转小写，去掉末尾点，去掉前缀 `www.`。
4. 与每条 `domains` 比较：hostname 等于该域名，或 hostname 以 `.{domain}` 结尾。
5. 多条命中时取域名更长的一条；长度相同则取目录表中先出现的。

触发（仅条目编辑草稿）：

- 条件：网址**内容发生变化**，且当时 `displayIcon` 为空。
- 命中则写入对应 `preset:`。
- 用户已选图标：不改。
- 用户点「使用首字母」清空后：不因当前网址立刻回填；再次改网址且图标仍为空时才重新匹配。

不在保存时二次猜测，不在列表页改已有条目。

## 首批品牌

约 79 个。选择器平铺；下表分组仅便于核对。实现时每条必须带上表中的 `id` 与域名。缺合规图则整条不做，并在 `SOURCES.md` 注明跳过原因。

### 社交 / 通讯

| id | 中文 | 英文 | 域名 |
|----|------|------|------|
| wechat | 微信 | WeChat | weixin.qq.com, wechat.com |
| wecom | 企业微信 | WeCom | work.weixin.qq.com |
| qq | QQ | QQ | im.qq.com, qq.com |
| weibo | 微博 | Weibo | weibo.com, weibo.cn |
| dingtalk | 钉钉 | DingTalk | dingtalk.com |
| feishu | 飞书 | Feishu | feishu.cn, larksuite.com |
| discord | Discord | Discord | discord.com, discordapp.com |
| slack | Slack | Slack | slack.com |
| telegram | Telegram | Telegram | telegram.org, t.me |
| whatsapp | WhatsApp | WhatsApp | whatsapp.com |
| facebook | Facebook | Facebook | facebook.com, fb.com |
| instagram | Instagram | Instagram | instagram.com |
| x | X | X | x.com, twitter.com |
| linkedin | LinkedIn | LinkedIn | linkedin.com |
| line | LINE | LINE | line.me |

### 支付 / 购物

| id | 中文 | 英文 | 域名 |
|----|------|------|------|
| alipay | 支付宝 | Alipay | alipay.com |
| unionpay | 云闪付 | UnionPay | unionpay.com, 95516.com |
| paypal | PayPal | PayPal | paypal.com |
| taobao | 淘宝 | Taobao | taobao.com |
| tmall | 天猫 | Tmall | tmall.com |
| jd | 京东 | JD | jd.com |
| pinduoduo | 拼多多 | Pinduoduo | pinduoduo.com, yangkeduo.com |
| meituan | 美团 | Meituan | meituan.com |
| eleme | 饿了么 | Ele.me | ele.me |
| amazon | Amazon | Amazon | amazon.com, amazon.cn, amazon.co.jp, amazon.co.uk, amazon.de |
| ebay | eBay | eBay | ebay.com |

### 娱乐 / 媒体

| id | 中文 | 英文 | 域名 |
|----|------|------|------|
| douyin | 抖音 | Douyin | douyin.com |
| kuaishou | 快手 | Kuaishou | kuaishou.com |
| bilibili | 哔哩哔哩 | Bilibili | bilibili.com, b23.tv |
| xiaohongshu | 小红书 | Xiaohongshu | xiaohongshu.com |
| zhihu | 知乎 | Zhihu | zhihu.com |
| douban | 豆瓣 | Douban | douban.com |
| tiktok | TikTok | TikTok | tiktok.com |
| youtube | YouTube | YouTube | youtube.com, youtu.be |
| netflix | Netflix | Netflix | netflix.com |
| spotify | Spotify | Spotify | spotify.com |
| twitch | Twitch | Twitch | twitch.tv |
| steam | Steam | Steam | steampowered.com, steamcommunity.com |
| netease-music | 网易云音乐 | NetEase Cloud Music | music.163.com |
| iqiyi | 爱奇艺 | iQIYI | iqiyi.com |
| tencent-video | 腾讯视频 | Tencent Video | v.qq.com |
| youku | 优酷 | Youku | youku.com |

### 开发 / 云 / AI

| id | 中文 | 英文 | 域名 |
|----|------|------|------|
| github | GitHub | GitHub | github.com |
| gitlab | GitLab | GitLab | gitlab.com |
| gitee | Gitee | Gitee | gitee.com |
| google | Google | Google | google.com, google.com.hk |
| microsoft | Microsoft | Microsoft | microsoft.com, live.com, office.com |
| apple | Apple | Apple | apple.com, icloud.com |
| aliyun | 阿里云 | Aliyun | aliyun.com, alibabacloud.com |
| tencent-cloud | 腾讯云 | Tencent Cloud | cloud.tencent.com, qcloud.com |
| aws | AWS | AWS | aws.amazon.com, console.aws.amazon.com |
| azure | Azure | Azure | azure.com, portal.azure.com |
| cloudflare | Cloudflare | Cloudflare | cloudflare.com |
| vercel | Vercel | Vercel | vercel.com |
| docker | Docker | Docker | docker.com |
| npm | npm | npm | npmjs.com |
| stackoverflow | Stack Overflow | Stack Overflow | stackoverflow.com |
| openai | OpenAI | OpenAI | openai.com, chatgpt.com |
| claude | Claude | Claude | claude.ai, anthropic.com |
| cursor | Cursor | Cursor | cursor.com, cursor.sh |

### 效率 / 邮箱

| id | 中文 | 英文 | 域名 |
|----|------|------|------|
| wps | WPS | WPS | wps.cn, kdocs.cn |
| outlook | Outlook | Outlook | outlook.com, outlook.live.com, outlook.office.com |
| gmail | Gmail | Gmail | gmail.com, mail.google.com |
| qqmail | QQ 邮箱 | QQ Mail | mail.qq.com, exmail.qq.com |
| netease-mail | 网易邮箱 | NetEase Mail | mail.163.com, 126.com, 163.com, yeah.net |
| zoom | Zoom | Zoom | zoom.us, zoom.com |
| tencent-meeting | 腾讯会议 | Tencent Meeting | meeting.tencent.com, voovmeeting.com |
| dropbox | Dropbox | Dropbox | dropbox.com |
| notion | Notion | Notion | notion.so, notion.com |
| figma | Figma | Figma | figma.com |
| adobe | Adobe | Adobe | adobe.com |
| baidu | 百度 | Baidu | baidu.com |

### 生活 / 出行 / 账号

| id | 中文 | 英文 | 域名 |
|----|------|------|------|
| rail12306 | 12306 | 12306 | 12306.cn |
| ctrip | 携程 | Ctrip | ctrip.com, trip.com |
| didi | 滴滴 | DiDi | didiglobal.com, didi.cn |
| uber | Uber | Uber | uber.com |
| airbnb | Airbnb | Airbnb | airbnb.com |
| huawei | 华为 | Huawei | huawei.com, vmall.com |
| xiaomi | 小米 | Xiaomi | mi.com, xiaomi.com |

`12306` 的 id 用 `rail12306`，避免纯数字 id。

更长、更具体的域名优先，因此 `mail.google.com` 归 Gmail、`music.163.com` 归网易云、`aws.amazon.com` 归 AWS、`mail.qq.com` 归 QQ 邮箱，而不是更宽的 `google.com` / `163.com` / `amazon.com` / `qq.com`。

## 错误处理

| 情况 | 行为 |
|------|------|
| 网址无法解析 | 不改图标 |
| 域名未命中 | 不改图标 |
| 目录有 id、glob 无文件 | 选择器不列出该项；已存该 id 的条目经 `isRenderableDisplayIcon` 为假，退回标题首字 |
| 已存未知 `preset:` | `isRenderableDisplayIcon` 为假，退回标题首字，不报错 |
| `<img>` 加载失败 | CategoryIconView 内显示默认 Folder |
| 单文件超过 500KB | 不收进仓库；收集阶段丢弃或再压缩 |

## 测试

对共享纯函数做单元测试，不在本次加 UI 端到端：

- `isPresetIcon` / 解析 id：合法前缀、空、Lucide 名、缺 id。
- `matchPresetIconByUrl`：空、无协议、`www.`、子域、未命中、更长域名优先（Gmail vs Google、AWS vs Amazon、网易云 vs 网易邮箱、QQ 邮箱 vs QQ）。
- `isRenderableDisplayIcon`：已知且文件在映射中的 preset 为真；未知 preset、空字符串为假。

选择器页签可见性、自动填触发时机用组件侧的薄封装保证，逻辑以纯函数为准。

## 文档

实现后：

- 在 `docs/code-map` 增加或补一条目展示图标说明：`display_icon` 三种取值、品牌目录位置、自动匹配规则。
- 不改 README 功能列表以外的安全模型表述。

## 以后可加（不在本期）

按分类分块浏览品牌页；用户自定义图标；保存时补一次匹配；为导入条目按网址补图标。
