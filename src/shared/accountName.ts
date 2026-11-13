export const ACCOUNT_NAME_MAX_CODE_POINTS = 32

export function normalizeAccountName(name: string): string {
  return name.trim()
}

export function validateAccountName(
  name: string,
  existingNames: readonly string[],
): 'empty' | 'too-long' | 'duplicate' | null {
  const normalized = normalizeAccountName(name)
  if (normalized.length === 0) return 'empty'
  if ([...normalized].length > ACCOUNT_NAME_MAX_CODE_POINTS) return 'too-long'
  if (existingNames.includes(normalized)) return 'duplicate'
  return null
}
