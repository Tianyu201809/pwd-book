import { describe, expect, it } from 'vitest'
import { shouldAutoFill } from './browserAutofillPolicy'

describe('shouldAutoFill', () => {
  it('auto-fills when the match signature is new', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: '',
        uiExists: true,
      }),
    ).toBe(true)
  })

  it('skips when the same signature was already auto-filled and the bar exists', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: 'entry-a',
        uiExists: true,
      }),
    ).toBe(false)
  })

  it('auto-fills when the bar is gone even if the signature matches the last mark', () => {
    expect(
      shouldAutoFill({
        signature: 'entry-a',
        lastAutoFilledSignature: 'entry-a',
        uiExists: false,
      }),
    ).toBe(true)
  })

  it('does not auto-fill an empty signature', () => {
    expect(
      shouldAutoFill({
        signature: '',
        lastAutoFilledSignature: '',
        uiExists: false,
      }),
    ).toBe(false)
  })
})
