const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** 去除空格与连字符，统一为大写 Base32 */
export function normalizeTotpSecret(input: string): string {
  return input.replace(/[\s-]/g, '').replace(/=+$/g, '').toUpperCase()
}

export function isValidTotpSecret(secret: string): boolean {
  const normalized = normalizeTotpSecret(secret)
  if (!normalized || normalized.length < 8) return false
  return /^[A-Z2-7]+$/.test(normalized)
}

function base32Decode(secret: string): Uint8Array {
  const normalized = normalizeTotpSecret(secret)
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) {
      throw new Error('INVALID_TOTP_SECRET')
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Uint8Array.from(bytes)
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, message)
  return new Uint8Array(signature)
}

async function hotp(secret: Uint8Array, counter: number, digits: number): Promise<string> {
  const counterBuf = new Uint8Array(8)
  const view = new DataView(counterBuf.buffer)
  view.setBigUint64(0, BigInt(counter))

  const hmac = await hmacSha1(secret, counterBuf)
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 10 ** digits).padStart(digits, '0')
}

export async function generateTotpCode(
  secret: string,
  timeMs = Date.now(),
  period = 30,
  digits = 6,
): Promise<string> {
  if (!isValidTotpSecret(secret)) {
    throw new Error('INVALID_TOTP_SECRET')
  }
  const key = base32Decode(secret)
  const counter = Math.floor(timeMs / 1000 / period)
  return hotp(key, counter, digits)
}

export function getTotpRemainingSeconds(timeMs = Date.now(), period = 30): number {
  const elapsed = Math.floor(timeMs / 1000) % period
  return period - elapsed
}
