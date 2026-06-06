import { createHmac } from 'crypto'

export const VERIFICATION_WINDOW_MS = 30_000

export function getSyncVerificationCode(
  fingerprint: string,
  now = Date.now(),
): string {
  const normalized = fingerprint.trim().toUpperCase()
  const window = Math.floor(now / VERIFICATION_WINDOW_MS)
  return createHmac('sha256', normalized)
    .update(String(window))
    .digest('hex')
    .slice(0, 6)
    .toUpperCase()
}

export function verificationCodesMatch(
  expected: string,
  actual: string,
  fingerprint: string,
  now = Date.now(),
): boolean {
  const normalizedExpected = expected.trim().toUpperCase()
  const normalizedActual = actual.trim().toUpperCase()
  if (normalizedExpected === normalizedActual) return true

  const current = getSyncVerificationCode(fingerprint, now)
  const previous = getSyncVerificationCode(fingerprint, now - VERIFICATION_WINDOW_MS)
  return normalizedActual === current || normalizedActual === previous
}
