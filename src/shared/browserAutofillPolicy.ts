export type AutoFillDecisionInput = {
  signature: string
  lastAutoFilledSignature: string
  uiExists: boolean
}

export function shouldAutoFill(input: AutoFillDecisionInput): boolean {
  if (!input.signature) return false
  if (!input.uiExists) return true
  return input.signature !== input.lastAutoFilledSignature
}
