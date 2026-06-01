export function escapeCsvCell(value: string): string {
  const text = value ?? ''
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildCsvContent(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  return `${[headerLine, ...dataLines].join('\r\n')}\r\n`
}
