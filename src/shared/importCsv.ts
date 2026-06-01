/** 解析 CSV 为二维单元格（支持引号与 "" 转义） */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim().length > 0)) rows.push(row)
      row = []
      continue
    }
    cell += ch
  }

  row.push(cell)
  if (row.some((c) => c.trim().length > 0)) rows.push(row)
  return rows
}

export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (!header) return
      const value = (cells[index] ?? '').trim()
      record[header] = value
      record[header.toLowerCase()] = value
    })
    return record
  })
}

export function pickField(record: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = record[key]
    if (direct?.trim()) return direct.trim()
    const lower = record[key.toLowerCase()]
    if (lower?.trim()) return lower.trim()
  }
  return ''
}
