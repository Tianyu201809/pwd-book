import { describe, expect, it } from 'vitest'
import { parsePairingPayload } from './syncClient'

describe('parsePairingPayload', () => {
  it('parses valid pairing json', () => {
    const payload = JSON.stringify({
      host: '192.168.1.10',
      port: 8765,
      accessPassword: 'abc123',
      fingerprint: 'ABCD1234',
      secure: true,
    })

    expect(parsePairingPayload(payload)).toEqual({
      host: '192.168.1.10',
      port: 8765,
      accessPassword: 'abc123',
      fingerprint: 'ABCD1234',
      secure: true,
    })
  })

  it('rejects incomplete pairing json', () => {
    expect(() => parsePairingPayload(JSON.stringify({ host: '1.1.1.1' }))).toThrow(
      'SYNC_PAIRING_INVALID',
    )
  })
})
