let activeAccountId = ''

export function setActiveAccountId(id: string): void {
  activeAccountId = id
}

export function getActiveAccountId(): string {
  if (!activeAccountId) {
    throw new Error('ACCOUNT_NOT_FOUND')
  }
  return activeAccountId
}
