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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function download(slug) {
  const url = `${BASE}/${slug}.png`
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null
      return { buffer, url, bytes: buffer.byteLength }
    } catch {
      if (attempt === 3) return null
      await sleep(800 * attempt)
    }
  }
  return null
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
      await sleep(120)
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
