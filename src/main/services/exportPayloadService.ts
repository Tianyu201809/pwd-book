import { listCategories } from './categoryService'
import { listEntries } from './vaultService'
import type { ExportPayload } from '../../shared/types'

export function buildExportPayload(): ExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    categories: listCategories(),
    entries: listEntries(),
  }
}
