import { IMPORT_SOURCES, type ImportSourceId } from './importSources'
import { PWD_BOOK_ENTRY_HEADERS } from './exportEntryColumns'

/** 可导出的第三方 CSV 格式（与导入来源一致，不含 PwdBook JSON） */
export type ExportFormatId = Exclude<ImportSourceId, 'pwdbook-json'>

export type PwdBookExportId = 'pwdbook-json' | 'pwdbook-csv' | 'pwdbook-xlsx'

export type ExportDestinationId = PwdBookExportId | ExportFormatId

/** 可通过 CSV IPC 导出的格式 */
export type CsvExportId = 'pwdbook-csv' | ExportFormatId

export type ExportDestinationGroup = 'pwdbook' | 'thirdParty'

export interface ExportDestinationMeta {
  id: ExportDestinationId
  group: ExportDestinationGroup
  /** i18n key under export.formats.* */
  nameKey: string
  /** i18n key under export.formats.*Desc */
  descKey: string
  monogram: string
  accent: string
  fileExt: string
  mimeType: string
  /** 第三方 CSV 常见列名，用于确认页展示 */
  expectedColumns: string[]
  /** 第三方 CSV 导入指引 i18n key under export.importGuide.* */
  importGuideKey?: string
}

const PWD_BOOK_DESTINATIONS: ExportDestinationMeta[] = [
  {
    id: 'pwdbook-json',
    group: 'pwdbook',
    nameKey: 'pwdbookJson',
    descKey: 'pwdbookJsonDesc',
    monogram: 'J',
    accent: 'var(--accent-primary)',
    fileExt: 'json',
    mimeType: 'application/json',
    expectedColumns: [],
  },
  {
    id: 'pwdbook-csv',
    group: 'pwdbook',
    nameKey: 'pwdbookCsv',
    descKey: 'pwdbookCsvDesc',
    monogram: 'C',
    accent: 'var(--accent-primary)',
    fileExt: 'csv',
    mimeType: 'text/csv;charset=utf-8',
    expectedColumns: [...PWD_BOOK_ENTRY_HEADERS],
  },
  {
    id: 'pwdbook-xlsx',
    group: 'pwdbook',
    nameKey: 'pwdbookExcel',
    descKey: 'pwdbookExcelDesc',
    monogram: 'X',
    accent: 'var(--accent-primary)',
    fileExt: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    expectedColumns: [],
  },
]

const THIRD_PARTY_DESTINATIONS: ExportDestinationMeta[] = IMPORT_SOURCES.filter(
  (source): source is (typeof IMPORT_SOURCES)[number] & { id: ExportFormatId } =>
    source.id !== 'pwdbook-json',
).map((source) => ({
  id: source.id,
  group: 'thirdParty' as const,
  nameKey: source.nameKey,
  descKey: source.descKey,
  monogram: source.monogram,
  accent: source.accent,
  fileExt: 'csv',
  mimeType: 'text/csv;charset=utf-8',
  expectedColumns: source.expectedColumns,
  importGuideKey: source.exportGuideKey,
}))

export const EXPORT_DESTINATIONS: ExportDestinationMeta[] = [
  ...PWD_BOOK_DESTINATIONS,
  ...THIRD_PARTY_DESTINATIONS,
]

export const EXPORT_FORMATS = THIRD_PARTY_DESTINATIONS

export function getExportDestination(id: ExportDestinationId): ExportDestinationMeta | undefined {
  return EXPORT_DESTINATIONS.find((dest) => dest.id === id)
}

export function getExportFormat(id: ExportFormatId): ExportDestinationMeta | undefined {
  return EXPORT_FORMATS.find((source) => source.id === id)
}

export function isPwdBookExport(id: ExportDestinationId): id is PwdBookExportId {
  return id === 'pwdbook-json' || id === 'pwdbook-csv' || id === 'pwdbook-xlsx'
}

export function isThirdPartyCsvExport(id: ExportDestinationId): id is ExportFormatId {
  return !isPwdBookExport(id)
}

export function isCsvExport(id: ExportDestinationId): boolean {
  return id === 'pwdbook-csv' || isThirdPartyCsvExport(id)
}
