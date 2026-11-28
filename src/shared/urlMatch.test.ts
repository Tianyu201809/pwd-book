import { describe, expect, it } from 'vitest'
import { entryUrlExactlyMatchesPage } from './urlMatch'

describe('entryUrlExactlyMatchesPage', () => {
  it('matches the same page including its hash route', () => {
    expect(
      entryUrlExactlyMatchesPage(
        'http://192.168.0.17:5000/#tasks-realty',
        'http://192.168.0.17:5000/#tasks-realty',
      ),
    ).toBe(true)
  })

  it('does not match a different hash route on the same host', () => {
    expect(
      entryUrlExactlyMatchesPage(
        'http://192.168.0.17:5000/#tasks-realty',
        'http://192.168.0.17:5000/#sql',
      ),
    ).toBe(false)
  })
})
