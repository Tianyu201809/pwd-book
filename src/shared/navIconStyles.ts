export type NavIconStyle = {
  color: string
  bg: string
}

/** Theme-aware badge; resolves via CSS variables for classic / animal skins */
export const THEME_ACCENT_BADGE: NavIconStyle = {
  color: 'var(--accent-primary)',
  bg: 'var(--accent-muted)',
}

/** Pastel badge colors aligned with categoryIcons palette */
export const NAV_ICON_STYLES = {
  layers: { color: '#0d9488', bg: 'rgba(13, 148, 136, 0.14)' },
  hash: { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' },
  trash: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)' },
  settings: { color: '#475569', bg: 'rgba(71, 85, 105, 0.14)' },
  lock: { color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.14)' },
  mailCheck: { color: '#14b8a6', bg: 'rgba(45, 212, 191, 0.14)' },
  passwordGen: { color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.14)' },
  shield: { color: '#059669', bg: 'rgba(5, 150, 105, 0.14)' },
  clipboard: { color: '#2563eb', bg: 'rgba(37, 99, 235, 0.14)' },
  palette: { color: '#9333ea', bg: 'rgba(147, 51, 234, 0.14)' },
  database: { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.14)' },
  info: { color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.14)' },
} as const satisfies Record<string, NavIconStyle>
