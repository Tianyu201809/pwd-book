import { describe, expect, it } from 'vitest'
import {
  MAX_CUSTOM_FIELDS_PER_ENTRY,
  normalizeCustomFields,
  parseCustomFields,
  serializeCustomFields,
} from './customFields'

describe('customFields', () => {
  it('normalizes and drops empty names', () => {
    expect(
      normalizeCustomFields([
        { name: ' PIN ', value: '1234' },
        { name: '', value: 'skip' },
        { name: 'Note', value: 'hello' },
      ]),
    ).toEqual([
      { name: 'PIN', value: '1234' },
      { name: 'Note', value: 'hello' },
    ])
  })

  it('caps field count', () => {
    const fields = Array.from({ length: MAX_CUSTOM_FIELDS_PER_ENTRY + 5 }, (_, index) => ({
      name: `field-${index}`,
      value: 'x',
    }))
    expect(normalizeCustomFields(fields)).toHaveLength(MAX_CUSTOM_FIELDS_PER_ENTRY)
  })

  it('parses stored json', () => {
    expect(parseCustomFields('[{"name":"A","value":"1"}]')).toEqual([{ name: 'A', value: '1' }])
    expect(parseCustomFields('not-json')).toEqual([])
  })

  it('serializes normalized fields', () => {
    expect(
      serializeCustomFields([
        { name: ' PIN ', value: '1234' },
        { name: '', value: 'skip' },
      ]),
    ).toBe('[{"name":"PIN","value":"1234"}]')
  })
})
