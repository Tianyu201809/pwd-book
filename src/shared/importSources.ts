/** 第三方密码管理器 / 浏览器 CSV 导入来源（UI + 后续解析器共用） */
export type ImportSourceId =
  | 'keepass'
  | 'enpass'
  | 'bitwarden'
  | 'onepassword'
  | 'chrome'
  | 'pwdbook-json'
  | 'pwdbook-csv'

/** PwdBook 原生备份（JSON / CSV），导入时保留备份中的分类 */
export function isPwdbookNativeImport(sourceId: ImportSourceId): boolean {
  return sourceId === 'pwdbook-json' || sourceId === 'pwdbook-csv'
}

export interface ImportSourceMeta {
  id: ImportSourceId
  /** 入库时使用的分类名称（按来源设备） */
  categoryName: string
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
    categoryName: 'KeePass',
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
    categoryName: 'Enpass',
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
    categoryName: 'Bitwarden',
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
    categoryName: '1Password',
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
    categoryName: 'Chrome',
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
    categoryName: 'PwdBook',
    nameKey: 'pwdbook',
    descKey: 'pwdbookDesc',
    monogram: 'Pb',
    accent: 'var(--accent-primary)',
    accept: 'application/json,.json',
    exportGuideKey: 'pwdbookGuide',
    expectedColumns: [],
  },
  {
    id: 'pwdbook-csv',
    categoryName: 'PwdBook',
    nameKey: 'pwdbookCsv',
    descKey: 'pwdbookCsvDesc',
    monogram: 'Pb',
    accent: 'var(--accent-primary)',
    accept: '.csv,text/csv',
    exportGuideKey: 'pwdbookCsvGuide',
    expectedColumns: [
      '标题',
      '网址',
      '本地程序路径',
      '用户名',
      '密码',
      '备注',
      '标签',
      '分类',
      '收藏',
    ],
  },
]

export function getImportSource(id: ImportSourceId): ImportSourceMeta | undefined {
  return IMPORT_SOURCES.find((s) => s.id === id)
}
