import { describe, expect, it } from 'vitest'
import { shouldAutoFill } from './browserAutofillPolicy'

describe('shouldAutoFill', () => {
  it('auto-fills when the match signature is new', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: '',
        uiExists: true,
        exactPageMatch: true,
      }),
    ).toBe(true)
  })

  it('skips when the same signature was already auto-filled and the bar exists', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: 'entry-a',
        uiExists: true,
        exactPageMatch: true,
      }),
    ).toBe(false)
  })

  it('auto-fills when the bar is gone even if the signature matches the last mark', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: 'entry-a',
        uiExists: false,
        exactPageMatch: true,
      }),
    ).toBe(true)
  })

  it('does not auto-fill an empty signature', () => {
    expect(
      shouldAutoFill({
        signature: '',
        lastAutoFilledSignature: '',
        uiExists: false,
        exactPageMatch: true,
      }),
    ).toBe(false)
  })

  it('does not auto-fill when only the host matches', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: '',
        uiExists: false,
        exactPageMatch: false,
      }),
    ).toBe(false)
  })
})
