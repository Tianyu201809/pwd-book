export function lockScreenMode(input: {
  accountCount: number
  initialized: boolean
  creatingAccount: boolean
}): 'boot-empty' | 'create-account' | 'setup-password' | 'unlock' {
  if (input.accountCount === 0) return 'boot-empty'
  if (input.creatingAccount) return 'create-account'
  if (!input.initialized) return 'setup-password'
  return 'unlock'
}
