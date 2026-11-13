export function clipboardStorageKeys(accountId: string): {
  session: string
  persistent: string
  favorites: string
} {
  return {
    session: `pwdbook-clipboard-session:${accountId}`,
    persistent: `pwdbook-clipboard-history:${accountId}`,
    favorites: `pwdbook-clipboard-favorites:${accountId}`,
  }
}
