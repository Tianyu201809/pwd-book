import { DEFAULT_ACCELERATORS } from './globalAccelerator'
import type { CloseWindowAction } from './types'

export const DEFAULT_ACCOUNT_NAME = '默认账号'
export const MACHINE_DOCUMENT_VERSION = 1

export const MACHINE_DB_KEYS = [
  'ui_locale',
  'launch_at_login_enabled',
  'close_window_action',
  'quick_bar_enabled',
  'quick_bar_accelerator',
  'main_window_shortcut_enabled',
  'main_window_shortcut_accelerator',
  'notes_manager_shortcut_enabled',
  'notes_manager_accelerator',
  'clipboard_accelerator',
  'browser_extension_id',
  'auto_update_enabled',
] as const

export interface AccountRecord {
  id: string
  name: string
  createdAt: number
}

export interface MachineSettings {
  uiLocale: 'zh-CN' | 'en'
  launchAtLoginEnabled: boolean
  closeWindowAction: CloseWindowAction
  quickBarEnabled: boolean
  quickBarAccelerator: string
  mainWindowShortcutEnabled: boolean
  mainWindowShortcutAccelerator: string
  notesManagerShortcutEnabled: boolean
  notesManagerAccelerator: string
  clipboardAccelerator: string
  browserExtensionId: string
  autoUpdateEnabled?: boolean
}

export interface MachineDocument {
  version: 1
  activeAccountId: string
  accounts: AccountRecord[]
  settings: MachineSettings
}

export function defaultMachineSettings(): MachineSettings {
  return {
    uiLocale: 'zh-CN',
    launchAtLoginEnabled: false,
    closeWindowAction: 'ask',
    quickBarEnabled: true,
    quickBarAccelerator: DEFAULT_ACCELERATORS.quickBar,
    mainWindowShortcutEnabled: true,
    mainWindowShortcutAccelerator: DEFAULT_ACCELERATORS.main,
    notesManagerShortcutEnabled: true,
    notesManagerAccelerator: DEFAULT_ACCELERATORS.notes,
    clipboardAccelerator: DEFAULT_ACCELERATORS.clipboard,
    browserExtensionId: '',
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

export function parseMachineDocument(raw: unknown): MachineDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Partial<MachineDocument>
  if (body.version !== 1 || typeof body.activeAccountId !== 'string') return null
  if (!Array.isArray(body.accounts)) return null
  const accounts = body.accounts.filter((item): item is AccountRecord =>
    Boolean(item) && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.createdAt === 'number')
  if (accounts.length !== body.accounts.length) return null
  const defaults = defaultMachineSettings()
  const settings = (body.settings ?? {}) as Record<string, unknown>
  const parsedSettings: MachineSettings = {
    uiLocale: settings.uiLocale === 'en' ? 'en' : defaults.uiLocale,
    launchAtLoginEnabled: asBoolean(settings.launchAtLoginEnabled, defaults.launchAtLoginEnabled),
    closeWindowAction: settings.closeWindowAction === 'tray' || settings.closeWindowAction === 'quit' ? settings.closeWindowAction : 'ask',
    quickBarEnabled: asBoolean(settings.quickBarEnabled, defaults.quickBarEnabled),
    quickBarAccelerator: asString(settings.quickBarAccelerator, defaults.quickBarAccelerator),
    mainWindowShortcutEnabled: asBoolean(settings.mainWindowShortcutEnabled, defaults.mainWindowShortcutEnabled),
    mainWindowShortcutAccelerator: asString(settings.mainWindowShortcutAccelerator, defaults.mainWindowShortcutAccelerator),
    notesManagerShortcutEnabled: asBoolean(settings.notesManagerShortcutEnabled, defaults.notesManagerShortcutEnabled),
    notesManagerAccelerator: asString(settings.notesManagerAccelerator, defaults.notesManagerAccelerator),
    clipboardAccelerator: asString(settings.clipboardAccelerator, defaults.clipboardAccelerator),
    browserExtensionId: asString(settings.browserExtensionId, defaults.browserExtensionId),
  }
  if (typeof settings.autoUpdateEnabled === 'boolean') {
    parsedSettings.autoUpdateEnabled = settings.autoUpdateEnabled
  }
  return {
    version: 1,
    activeAccountId: body.activeAccountId,
    accounts,
    settings: parsedSettings,
  }
}
