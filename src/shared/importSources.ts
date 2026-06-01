/** 第三方密码管理器 / 浏览器 CSV 导入来源（UI + 后续解析器共用） */
export type ImportSourceId =
  | 'keepass'
  | 'enpass'
  | 'bitwarden'
  | 'onepassword'
  | 'chrome'
  | 'pwdbook-json'

export interface ImportSourceMeta {
  id: ImportSourceId
  /** i18n key under import.sources.* */
  nameKey: string
  descKey: string
  /** 单字/缩写标识，用于卡片 monogram */
  monogram: string
  /** 品牌色点缀（非官方 Logo，仅辅助识别） */
  accent: string
  accept: string
  /** i18n key：如何从该应用导出 CSV */
  exportGuideKey: string
  /** 典型 CSV 列名，用于预览区「期望列」提示 */
  expectedColumns: string[]
}

export const IMPORT_SOURCES: ImportSourceMeta[] = [
  {
    id: 'keepass',
    nameKey: 'keepass',
    descKey: 'keepassDesc',
    monogram: 'K',
    accent: '#4fa86a',
    accept: '.csv,text/csv',
    exportGuideKey: 'keepassGuide',
    expectedColumns: ['Account', 'Login Name', 'Password', 'Web Site', 'Comments', 'Group'],
  },
  {
    id: 'enpass',
    nameKey: 'enpass',
    descKey: 'enpassDesc',
    monogram: 'E',
    accent: '#3b82f6',
    accept: '.csv,text/csv',
    exportGuideKey: 'enpassGuide',
    expectedColumns: ['Title', 'Username', 'Email', 'Password', 'Website', 'Note'],
  },
  {
    id: 'bitwarden',
    nameKey: 'bitwarden',
    descKey: 'bitwardenDesc',
    monogram: 'B',
    accent: '#175ddc',
    accept: '.csv,text/csv',
    exportGuideKey: 'bitwardenGuide',
    expectedColumns: ['name', 'login_uri', 'login_username', 'login_password', 'notes', 'folder'],
  },
  {
    id: 'onepassword',
    nameKey: 'onepassword',
    descKey: 'onepasswordDesc',
    monogram: '1',
    accent: '#0572ec',
    accept: '.csv,text/csv',
    exportGuideKey: 'onepasswordGuide',
    expectedColumns: ['Title', 'Website', 'Username', 'Password', 'Notes'],
  },
  {
    id: 'chrome',
    nameKey: 'chrome',
    descKey: 'chromeDesc',
    monogram: 'Cr',
    accent: '#ea4335',
    accept: '.csv,text/csv',
    exportGuideKey: 'chromeGuide',
    expectedColumns: ['name', 'url', 'username', 'password'],
  },
  {
    id: 'pwdbook-json',
    nameKey: 'pwdbook',
    descKey: 'pwdbookDesc',
    monogram: 'Pb',
    accent: 'var(--accent-primary)',
    accept: 'application/json,.json',
    exportGuideKey: 'pwdbookGuide',
    expectedColumns: [],
  },
]

export function getImportSource(id: ImportSourceId): ImportSourceMeta | undefined {
  return IMPORT_SOURCES.find((s) => s.id === id)
}
