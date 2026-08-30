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
