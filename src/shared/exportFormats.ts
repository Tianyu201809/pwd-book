import { IMPORT_SOURCES, type ImportSourceId } from './importSources'

/** 可导出的第三方 CSV 格式（与导入来源一致，不含 PwdBook JSON） */
export type ExportFormatId = Exclude<ImportSourceId, 'pwdbook-json'>

export const EXPORT_FORMATS = IMPORT_SOURCES.filter(
  (source): source is (typeof IMPORT_SOURCES)[number] & { id: ExportFormatId } =>
    source.id !== 'pwdbook-json',
)

export function getExportFormat(id: ExportFormatId) {
  return EXPORT_FORMATS.find((source) => source.id === id)
}
