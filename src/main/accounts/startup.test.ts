import fs from 'fs'
import os from 'os'
import path from 'path'
import initSqlJs from 'sql.js'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultMachineSettings } from '../../shared/machineDocument'
import { bootAccounts } from './startup'

const roots: string[] = []

function tempUserData(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwdbook-boot-'))
  roots.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of roots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function locateWasm(): string {
  return path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
}

async function writeSettingsDb(file: string, rows: Record<string, string>): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => locateWasm() })
  const db = new SQL.Database()
  db.run('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)')
  for (const [key, value] of Object.entries(rows)) {
    db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', [key, value])
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.from(db.export()))
  db.close()
}

async function writeDbWithoutSettings(file: string): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => locateWasm() })
  const db = new SQL.Database()
  db.run('CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL)')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.from(db.export()))
  db.close()
}

async function readSettings(file: string): Promise<Record<string, string>> {
  const SQL = await initSqlJs({ locateFile: () => locateWasm() })
  const db = new SQL.Database(fs.readFileSync(file))
  const rows: Record<string, string> = {}
  const stmt = db.prepare('SELECT key, value FROM app_settings')
  while (stmt.step()) {
    const [key, value] = stmt.get()
    rows[String(key)] = String(value)
  }
  stmt.free()
  db.close()
  return rows
}

function writeText(root: string, relativePath: string, contents: string): void {
  const file = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

function listTree(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      out.push(entry.isDirectory() ? `${relative}/` : relative)
      if (entry.isDirectory()) walk(absolute)
    }
  }
  walk(root)
  return out
}

function corruptName(prefix: string, now: number): string {
  const timestamp = new Date(now).toISOString().replace(/[:.]/g, '-')
  return `${prefix}.corrupt-${timestamp}`
}

describe('bootAccounts', () => {
  it('migrates a legacy vault into the default account and stays put on the next boot', async () => {
    const userData = tempUserData()
    const createdAt = 1_700_000_000_000
    let ids = 0
    const createId = (): string => {
      ids += 1
      return `acct-${ids}`
    }
    await writeSettingsDb(path.join(userData, 'pwdbook.db'), {
      ui_locale: 'en',
      master_salt: 'abc',
      launch_at_login_enabled: 'true',
      close_window_action: 'tray',
      quick_bar_enabled: 'false',
      quick_bar_accelerator: 'Ctrl+Alt+Q',
      main_window_shortcut_enabled: 'false',
      main_window_shortcut_accelerator: 'Ctrl+Alt+M',
      notes_manager_shortcut_enabled: 'true',
      notes_manager_accelerator: 'Ctrl+Alt+N',
      clipboard_accelerator: 'Ctrl+Alt+C',
      browser_extension_id: 'ext-1',
      auto_update_enabled: 'false',
      clipboard_enabled: 'true',
    })
    writeText(userData, 'attachments/keep.txt', 'attach')
    writeText(userData, 'sync-server/a.txt', 'sync')
    writeText(userData, 'wifi-sync-certs/c.txt', 'cert')
    writeText(userData, 'native-host/keep.txt', 'host')
    writeText(userData, 'native-bridge.json', '{"ok":true}')

    const first = await bootAccounts(userData, () => createdAt, createId)

    expect(first).toEqual({
      kind: 'ready',
      warning: null,
      document: {
        version: 1,
        activeAccountId: 'acct-1',
        accounts: [{ id: 'acct-1', name: '默认账号', createdAt }],
        settings: {
          ...defaultMachineSettings(),
          uiLocale: 'en',
          launchAtLoginEnabled: true,
          closeWindowAction: 'tray',
          quickBarEnabled: false,
          quickBarAccelerator: 'Ctrl+Alt+Q',
          mainWindowShortcutEnabled: false,
          mainWindowShortcutAccelerator: 'Ctrl+Alt+M',
          notesManagerShortcutEnabled: true,
          notesManagerAccelerator: 'Ctrl+Alt+N',
          clipboardAccelerator: 'Ctrl+Alt+C',
          browserExtensionId: 'ext-1',
          autoUpdateEnabled: false,
        },
      },
    })
    const accountDir = path.join(userData, 'accounts', 'acct-1')
    expect(fs.readFileSync(path.join(accountDir, 'attachments', 'keep.txt'), 'utf8')).toBe('attach')
    expect(fs.readFileSync(path.join(accountDir, 'sync-server', 'a.txt'), 'utf8')).toBe('sync')
    expect(fs.readFileSync(path.join(accountDir, 'wifi-sync-certs', 'c.txt'), 'utf8')).toBe('cert')
    expect(fs.existsSync(path.join(accountDir, 'pwdbook.db'))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'pwdbook.db'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'attachments'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'sync-server'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'wifi-sync-certs'))).toBe(false)
    expect(fs.readFileSync(path.join(userData, 'native-host', 'keep.txt'), 'utf8')).toBe('host')
    expect(fs.readFileSync(path.join(userData, 'native-bridge.json'), 'utf8')).toBe('{"ok":true}')
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'machine.json'), 'utf8')) as {
      accounts: Array<{ name: string }>
      settings: { uiLocale: string }
    }
    expect(saved.accounts[0]?.name).toBe('默认账号')
    expect(saved.settings.uiLocale).toBe('en')
    const rows = await readSettings(path.join(accountDir, 'pwdbook.db'))
    expect(rows.master_salt).toBe('abc')
    expect(rows.clipboard_enabled).toBe('true')
    expect(rows).not.toHaveProperty('ui_locale')
    expect(rows).not.toHaveProperty('auto_update_enabled')
    expect(rows).not.toHaveProperty('launch_at_login_enabled')

    const tree = listTree(userData)
    const second = await bootAccounts(userData, () => createdAt + 50, () => {
      throw new Error('createId must not run again')
    })
    expect(second.kind).toBe('ready')
    if (second.kind === 'ready') {
      expect(second.warning).toBeNull()
      expect(second.document.accounts[0]?.id).toBe('acct-1')
      expect(second.document.accounts[0]?.createdAt).toBe(createdAt)
    }
    expect(listTree(userData)).toEqual(tree)
    expect(ids).toBe(1)
  })

  it('registers the only unregistered library as the default account without moving it', async () => {
    const userData = tempUserData()
    await writeSettingsDb(path.join(userData, 'accounts', 'orphan', 'pwdbook.db'), {
      ui_locale: 'en',
      master_salt: 'abc',
      close_window_action: 'quit',
      auto_update_enabled: 'true',
    })

    const result = await bootAccounts(userData, () => 42, () => {
      throw new Error('orphan adoption must use the directory name')
    })

    expect(result).toMatchObject({
      kind: 'ready',
      warning: null,
      document: {
        version: 1,
        activeAccountId: 'orphan',
        accounts: [{ id: 'orphan', name: '默认账号', createdAt: 42 }],
        settings: {
          uiLocale: 'en',
          closeWindowAction: 'quit',
          autoUpdateEnabled: true,
        },
      },
    })
    expect(fs.existsSync(path.join(userData, 'accounts', 'orphan', 'pwdbook.db'))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'pwdbook.db'))).toBe(false)
    const rows = await readSettings(path.join(userData, 'accounts', 'orphan', 'pwdbook.db'))
    expect(rows.master_salt).toBe('abc')
    expect(rows).not.toHaveProperty('ui_locale')
  })

  it('uses default machine settings when the orphan library has no app_settings table', async () => {
    const userData = tempUserData()
    await writeDbWithoutSettings(path.join(userData, 'accounts', 'plain', 'pwdbook.db'))

    const result = await bootAccounts(userData, () => 7, () => {
      throw new Error('orphan adoption must use the directory name')
    })

    expect(result).toMatchObject({
      kind: 'ready',
      warning: null,
      document: {
        activeAccountId: 'plain',
        accounts: [{ id: 'plain', name: '默认账号', createdAt: 7 }],
        settings: defaultMachineSettings(),
      },
    })
    expect(fs.existsSync(path.join(userData, 'accounts', 'plain', 'pwdbook.db'))).toBe(true)
  })

  it('returns ambiguous-accounts and does not write machine.json for two libraries', async () => {
    const userData = tempUserData()
    await writeSettingsDb(path.join(userData, 'accounts', 'one', 'pwdbook.db'), {})
    await writeSettingsDb(path.join(userData, 'accounts', 'two', 'pwdbook.db'), {})

    const result = await bootAccounts(userData)

    expect(result).toEqual({ kind: 'blocked', reason: 'ambiguous-accounts' })
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'accounts', 'one', 'pwdbook.db'))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'accounts', 'two', 'pwdbook.db'))).toBe(true)
  })

  it('quarantines a non-sqlite root database and returns fresh', async () => {
    const userData = tempUserData()
    const now = 1_700_000_000_000
    fs.writeFileSync(path.join(userData, 'pwdbook.db'), 'not-sqlite')

    const result = await bootAccounts(userData, () => now, () => {
      throw new Error('invalid sqlite must not create an account id')
    })

    expect(result).toEqual({ kind: 'fresh' })
    expect(fs.existsSync(path.join(userData, 'pwdbook.db'))).toBe(false)
    expect(fs.existsSync(path.join(userData, corruptName('pwdbook.db', now)))).toBe(true)
    expect(fs.readFileSync(path.join(userData, corruptName('pwdbook.db', now)), 'utf8')).toBe('not-sqlite')
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'accounts'))).toBe(false)
  })

  it('quarantines an unparseable registry when an account library exists and does not create another', async () => {
    const userData = tempUserData()
    const now = 1_700_000_000_000
    fs.writeFileSync(path.join(userData, 'machine.json'), '{')
    await writeSettingsDb(path.join(userData, 'accounts', 'kept', 'pwdbook.db'), { master_salt: 'abc' })

    const result = await bootAccounts(userData, () => now, () => {
      throw new Error('corrupt registry must not create an account id')
    })

    expect(result).toEqual({ kind: 'blocked', reason: 'registry-corrupt' })
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
    expect(fs.readFileSync(path.join(userData, corruptName('machine.json', now)), 'utf8')).toBe('{')
    expect(fs.readdirSync(path.join(userData, 'accounts'))).toEqual(['kept'])
    expect(fs.existsSync(path.join(userData, 'accounts', 'kept', 'pwdbook.db'))).toBe(true)
  })

  it('treats a parseable but invalid registry document as corrupt', async () => {
    const userData = tempUserData()
    const now = 0
    fs.writeFileSync(path.join(userData, 'machine.json'), JSON.stringify({ version: 2 }))
    await writeDbWithoutSettings(path.join(userData, 'accounts', 'kept', 'pwdbook.db'))

    const result = await bootAccounts(userData, () => now)

    expect(result).toEqual({ kind: 'blocked', reason: 'registry-corrupt' })
    expect(fs.existsSync(path.join(userData, corruptName('machine.json', now)))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'accounts', 'kept', 'pwdbook.db'))).toBe(true)
    expect(fs.readdirSync(path.join(userData, 'accounts'))).toEqual(['kept'])
  })

  it('continues as a fresh install when a corrupt registry has no account library', async () => {
    const userData = tempUserData()
    const now = 0
    fs.writeFileSync(path.join(userData, 'machine.json'), 'not-json')

    const result = await bootAccounts(userData, () => now)

    expect(result).toEqual({ kind: 'fresh' })
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
    expect(fs.existsSync(path.join(userData, corruptName('machine.json', now)))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'accounts'))).toBe(false)
  })

  it('migrates the legacy database after quarantining a corrupt registry with no account library', async () => {
    const userData = tempUserData()
    const now = 99
    fs.writeFileSync(path.join(userData, 'machine.json'), '{')
    await writeSettingsDb(path.join(userData, 'pwdbook.db'), { ui_locale: 'en', master_salt: 'abc' })

    const result = await bootAccounts(userData, () => now, () => 'migrated')

    expect(result).toMatchObject({
      kind: 'ready',
      warning: null,
      document: {
        activeAccountId: 'migrated',
        accounts: [{ id: 'migrated', name: '默认账号', createdAt: now }],
      },
    })
    expect(fs.existsSync(path.join(userData, corruptName('machine.json', now)))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'accounts', 'migrated', 'pwdbook.db'))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'pwdbook.db'))).toBe(false)
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'machine.json'), 'utf8')) as {
      accounts: Array<{ name: string }>
    }
    expect(saved.accounts[0]?.name).toBe('默认账号')
  })

  it('returns registry-inconsistent without renaming a parseable registry', async () => {
    const userData = tempUserData()
    const original = JSON.stringify({
      version: 1,
      activeAccountId: 'missing',
      accounts: [{ id: 'a', name: '默认账号', createdAt: 1 }],
      settings: {},
    })
    fs.writeFileSync(path.join(userData, 'machine.json'), original)
    await writeSettingsDb(path.join(userData, 'accounts', 'a', 'pwdbook.db'), { master_salt: 'abc' })
    writeText(userData, 'accounts/a.deleting/keep.txt', 'stay')

    const result = await bootAccounts(userData, () => 5, () => {
      throw new Error('inconsistent registry must not create an account id')
    })

    expect(result).toEqual({ kind: 'blocked', reason: 'registry-inconsistent' })
    expect(fs.readFileSync(path.join(userData, 'machine.json'), 'utf8')).toBe(original)
    expect(fs.readdirSync(userData).filter((name) => name.includes('.corrupt-'))).toEqual([])
    expect(fs.existsSync(path.join(userData, 'accounts', 'a.deleting', 'keep.txt'))).toBe(true)
  })

  it('removes a deleting directory that the registry no longer lists', async () => {
    const userData = tempUserData()
    fs.writeFileSync(path.join(userData, 'machine.json'), JSON.stringify({
      version: 1,
      activeAccountId: 'keep',
      accounts: [{ id: 'keep', name: '默认账号', createdAt: 1 }],
      settings: {},
    }))
    writeText(userData, 'accounts/keep/pwdbook.db', 'db')
    writeText(userData, 'accounts/gone.deleting/pwdbook.db', 'leftover')

    const result = await bootAccounts(userData)

    expect(result).toMatchObject({ kind: 'ready', warning: null })
    expect(fs.existsSync(path.join(userData, 'accounts', 'gone.deleting'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'accounts', 'keep', 'pwdbook.db'))).toBe(true)
  })

  it('restores a deleting directory that the registry still lists', async () => {
    const userData = tempUserData()
    fs.writeFileSync(path.join(userData, 'machine.json'), JSON.stringify({
      version: 1,
      activeAccountId: 'acc',
      accounts: [{ id: 'acc', name: '工作', createdAt: 9 }],
      settings: { uiLocale: 'en' },
    }))
    writeText(userData, 'accounts/acc.deleting/pwdbook.db', 'vault')
    writeText(userData, 'accounts/acc.deleting/attachments/keep.txt', 'attach')

    const result = await bootAccounts(userData, () => 1, () => {
      throw new Error('restoring a delete must not create an account id')
    })

    expect(result).toMatchObject({
      kind: 'ready',
      warning: 'delete-incomplete',
      document: {
        activeAccountId: 'acc',
        accounts: [{ id: 'acc', name: '工作', createdAt: 9 }],
        settings: { uiLocale: 'en' },
      },
    })
    expect(fs.readFileSync(path.join(userData, 'accounts', 'acc', 'pwdbook.db'), 'utf8')).toBe('vault')
    expect(fs.readFileSync(path.join(userData, 'accounts', 'acc', 'attachments', 'keep.txt'), 'utf8')).toBe('attach')
    expect(fs.existsSync(path.join(userData, 'accounts', 'acc.deleting'))).toBe(false)
    expect(fs.existsSync(path.join(userData, 'pwdbook.db'))).toBe(false)
  })

  it('does not migrate or create a library when machine.json is already valid', async () => {
    const userData = tempUserData()
    const original = JSON.stringify({
      version: 1,
      activeAccountId: 'keep',
      accounts: [{ id: 'keep', name: '工作', createdAt: 3 }],
      settings: {},
    })
    fs.writeFileSync(path.join(userData, 'machine.json'), original)
    await writeSettingsDb(path.join(userData, 'pwdbook.db'), { ui_locale: 'en', master_salt: 'abc' })
    writeText(userData, 'accounts/keep/note.txt', 'stay')

    const result = await bootAccounts(userData, () => 8, () => {
      throw new Error('valid registry must not create an account id')
    })

    expect(result).toMatchObject({
      kind: 'ready',
      warning: null,
      document: {
        activeAccountId: 'keep',
        accounts: [{ id: 'keep', name: '工作', createdAt: 3 }],
      },
    })
    expect(fs.readFileSync(path.join(userData, 'machine.json'), 'utf8')).toBe(original)
    expect(fs.existsSync(path.join(userData, 'pwdbook.db'))).toBe(true)
    expect(fs.readdirSync(path.join(userData, 'accounts'))).toEqual(['keep'])
  })

  it('returns fresh when there is no registry and no library', async () => {
    const userData = tempUserData()
    await expect(bootAccounts(userData)).resolves.toEqual({ kind: 'fresh' })
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
  })

  it('does not write machine.json when a legacy move fails', async () => {
    const userData = tempUserData()
    await writeSettingsDb(path.join(userData, 'pwdbook.db'), { master_salt: 'abc' })
    writeText(userData, 'attachments/keep.txt', 'attach')
    writeText(userData, 'accounts/fixed/attachments/block.txt', 'blocking')

    await expect(bootAccounts(userData, () => 1, () => 'fixed')).rejects.toThrow()
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
  })

  it('drops unlisted deleting leftovers before adopting the remaining library', async () => {
    const userData = tempUserData()
    await writeSettingsDb(path.join(userData, 'accounts', 'orphan', 'pwdbook.db'), {})
    writeText(userData, 'accounts/old.deleting/pwdbook.db', 'leftover')

    const result = await bootAccounts(userData, () => 4, () => {
      throw new Error('orphan adoption must use the directory name')
    })

    expect(result).toMatchObject({
      kind: 'ready',
      document: { activeAccountId: 'orphan', accounts: [{ id: 'orphan', name: '默认账号', createdAt: 4 }] },
    })
    expect(fs.existsSync(path.join(userData, 'accounts', 'old.deleting'))).toBe(false)
  })

  it('keeps deleting leftovers when a corrupt registry still has account directories', async () => {
    const userData = tempUserData()
    const now = 12
    fs.writeFileSync(path.join(userData, 'machine.json'), '{')
    writeText(userData, 'accounts/old.deleting/pwdbook.db', 'leftover')

    const result = await bootAccounts(userData, () => now)

    expect(result).toEqual({ kind: 'blocked', reason: 'registry-corrupt' })
    expect(fs.existsSync(path.join(userData, 'accounts', 'old.deleting', 'pwdbook.db'))).toBe(true)
    expect(fs.existsSync(path.join(userData, corruptName('machine.json', now)))).toBe(true)
    expect(fs.existsSync(path.join(userData, 'machine.json'))).toBe(false)
  })
})
