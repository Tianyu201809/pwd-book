import type { SecuritySettings } from './types'

export const DEFAULT_ACCELERATORS = {
  quickBar: 'Alt+Shift+P',
  main: 'Alt+Shift+M',
  notes: 'Alt+Shift+N',
  clipboard: 'Alt+Shift+O',
} as const

export const NOTES_MANAGER_ACCELERATOR = DEFAULT_ACCELERATORS.notes
export const CLIPBOARD_ACCELERATOR = DEFAULT_ACCELERATORS.clipboard

export type ShortcutSlot = keyof typeof DEFAULT_ACCELERATORS
export type ShortcutPlatform = 'win32' | 'darwin' | 'linux'

const SHORTCUT_FIELDS = {
  quickBar: 'quickBarAccelerator',
  main: 'mainWindowShortcutAccelerator',
  notes: 'notesManagerAccelerator',
  clipboard: 'clipboardAccelerator',
} as const satisfies Record<ShortcutSlot, keyof SecuritySettings>

export type ShortcutField = (typeof SHORTCUT_FIELDS)[ShortcutSlot]

const MODIFIER_ORDER = ['Command', 'Ctrl', 'Alt', 'Shift', 'Super'] as const
const PRIMARY_MODIFIERS = new Set(['Command', 'Ctrl', 'Alt', 'Super'])

const KEY_LABELS: Record<string, string> = {
  Super: 'Win',
  Command: 'Cmd',
  Return: 'Enter',
  Escape: 'Esc',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  numadd: 'Num+',
  numsub: 'Num-',
  nummult: 'Num*',
  numdiv: 'Num/',
  numdec: 'Num.',
}

const CODE_KEYS: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Enter: 'Return',
  NumpadEnter: 'Return',
  Escape: 'Escape',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Equal: 'Plus',
  NumpadAdd: 'numadd',
  NumpadSubtract: 'numsub',
  NumpadMultiply: 'nummult',
  NumpadDivide: 'numdiv',
  NumpadDecimal: 'numdec',
}

export interface ShortcutKeyInput {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  platform: ShortcutPlatform
}

export type AcceleratorParseResult =
  | { status: 'modifier' }
  | { status: 'needs-modifier' }
  | { status: 'unsupported' }
  | { status: 'ok'; accelerator: string }

export interface ReservedAccelerator {
  label: string
  accelerator: string
}

export type AcceleratorUpdateResult =
  | { ok: true; accelerators: Record<ShortcutField, string> }
  | { ok: false; reason: 'invalid' | 'conflict' }

function canonicalModifier(part: string): (typeof MODIFIER_ORDER)[number] | null {
  const token = part.trim().toLowerCase()
  if (token === 'ctrl' || token === 'control' || token === 'commandorcontrol') return 'Ctrl'
  if (token === 'alt' || token === 'option') return 'Alt'
  if (token === 'shift') return 'Shift'
  if (token === 'super' || token === 'meta' || token === 'win' || token === 'windows') return 'Super'
  if (token === 'command' || token === 'cmd') return 'Command'
  return null
}

function canonicalKey(part: string): string | null {
  const token = part.trim()
  if (!token || canonicalModifier(token)) return null
  if (/^[a-z]$/i.test(token)) return token.toUpperCase()
  if (/^[0-9]$/.test(token)) return token
  if (/^f([1-9]|1\d|2[0-4])$/i.test(token)) return token.toUpperCase()
  if (/^num[0-9]$/i.test(token)) return `num${token.slice(3)}`
  const specials = [
    'Plus',
    'Space',
    'Tab',
    'Backspace',
    'Delete',
    'Insert',
    'Return',
    'Up',
    'Down',
    'Left',
    'Right',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Escape',
    'numdec',
    'numadd',
    'numsub',
    'nummult',
    'numdiv',
  ]
  const match = specials.find((name) => name.toLowerCase() === token.toLowerCase())
  return match ?? null
}

export function normalizeAccelerator(raw: string): string | null {
  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const modifiers: string[] = []
  let key: string | null = null
  for (const part of parts) {
    const modifier = canonicalModifier(part)
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier)
      continue
    }
    const nextKey = canonicalKey(part)
    if (!nextKey || key) return null
    key = nextKey
  }
  if (!key || !modifiers.some((modifier) => PRIMARY_MODIFIERS.has(modifier))) return null
  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier))
  return [...ordered, key].join('+')
}

export function readStoredAccelerator(raw: string | null | undefined, fallback: string): string {
  return normalizeAccelerator(raw ?? '') ?? fallback
}

function keyFromCode(code: string): string | null {
  if (CODE_KEYS[code]) return CODE_KEYS[code]
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]
  const fn = /^F([1-9]|1\d|2[0-4])$/.exec(code)
  if (fn) return `F${fn[1]}`
  const numpad = /^Numpad([0-9])$/.exec(code)
  if (numpad) return `num${numpad[1]}`
  return null
}

export function acceleratorFromKeyInput(input: ShortcutKeyInput): AcceleratorParseResult {
  if (input.key === 'Control' || input.key === 'Shift' || input.key === 'Alt' || input.key === 'Meta') {
    return { status: 'modifier' }
  }
  const key = keyFromCode(input.code)
  if (!key) return { status: 'unsupported' }
  if (key === 'Plus' && !input.shiftKey) return { status: 'unsupported' }
  const modifiers: string[] = []
  if (input.ctrlKey) modifiers.push('Ctrl')
  if (input.altKey) modifiers.push('Alt')
  if (input.shiftKey) modifiers.push('Shift')
  if (input.metaKey) modifiers.push(input.platform === 'darwin' ? 'Command' : 'Super')
  if (!modifiers.some((modifier) => PRIMARY_MODIFIERS.has(modifier))) return { status: 'needs-modifier' }
  const accelerator = normalizeAccelerator([...modifiers, key].join('+'))
  if (!accelerator) return { status: 'unsupported' }
  return { status: 'ok', accelerator }
}

export function splitAccelerator(raw: string): string[] {
  const normalized = normalizeAccelerator(raw)
  return (normalized ?? raw).split('+').filter(Boolean)
}

export function acceleratorKeyLabel(part: string, platform: ShortcutPlatform = 'win32'): string {
  if (part === 'Super') return platform === 'darwin' ? 'Cmd' : 'Win'
  if (/^num[0-9]$/.test(part)) return part.slice(3)
  return KEY_LABELS[part] ?? part
}

export function findReservedAccelerator(
  candidate: string,
  reserved: ReservedAccelerator[],
): ReservedAccelerator | null {
  const normalized = normalizeAccelerator(candidate)
  if (!normalized) return null
  return reserved.find((item) => normalizeAccelerator(item.accelerator) === normalized) ?? null
}

function slotValue(settings: SecuritySettings, slot: ShortcutSlot): string {
  switch (slot) {
    case 'quickBar':
      return settings.quickBarAccelerator
    case 'main':
      return settings.mainWindowShortcutAccelerator
    case 'notes':
      return settings.notesManagerAccelerator
    case 'clipboard':
      return settings.clipboardAccelerator
  }
}

export function otherAccelerators(
  settings: SecuritySettings,
  self: ShortcutSlot,
  labels: Record<ShortcutSlot, string>,
): ReservedAccelerator[] {
  return (Object.keys(DEFAULT_ACCELERATORS) as ShortcutSlot[])
    .filter((slot) => slot !== self)
    .map((slot) => ({
      label: labels[slot],
      accelerator: slotValue(settings, slot),
    }))
}

function defaultFor(field: ShortcutField): string {
  switch (field) {
    case 'quickBarAccelerator':
      return DEFAULT_ACCELERATORS.quickBar
    case 'mainWindowShortcutAccelerator':
      return DEFAULT_ACCELERATORS.main
    case 'notesManagerAccelerator':
      return DEFAULT_ACCELERATORS.notes
    case 'clipboardAccelerator':
      return DEFAULT_ACCELERATORS.clipboard
  }
}

export function resolveAccelerators(
  current: Record<ShortcutField, string>,
  partial: Partial<Record<ShortcutField, string>>,
): AcceleratorUpdateResult {
  const fields = Object.values(SHORTCUT_FIELDS)
  const touched = fields.some((field) => partial[field] !== undefined)
  const accelerators = {} as Record<ShortcutField, string>
  for (const field of fields) {
    if (partial[field] !== undefined) {
      const normalized = normalizeAccelerator(String(partial[field]))
      if (!normalized) return { ok: false, reason: 'invalid' }
      accelerators[field] = normalized
      continue
    }
    accelerators[field] = normalizeAccelerator(current[field] ?? '') ?? defaultFor(field)
  }
  if (touched) {
    const values = fields.map((field) => accelerators[field])
    if (new Set(values).size !== values.length) return { ok: false, reason: 'conflict' }
  }
  return { ok: true, accelerators }
}
