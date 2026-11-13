import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultMachineSettings, type AccountRecord } from '../../shared/machineDocument'
import { getActiveAccountId, setActiveAccountId } from './activeAccount'
import {
  createAccount,
  deleteAccount,
  rebuildEmptyVault,
  renameAccount,
  selectAccount,
  type AccountDeps,
} from './accountService'
import { writeMachineDocument } from './machineStore'

const roots: string[] = []

function tempUserData(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwdbook-account-'))
  roots.push(dir)
  return dir
}

afterEach(() => {
  setActiveAccountId('')
  for (const dir of roots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function accountRecord(id: string, name: string, createdAt: number): AccountRecord {
  return { id, name, createdAt }
}

function writeDocument(userData: string, activeAccountId: string, accounts: AccountRecord[]): void {
  writeMachineDocument(userData, {
    version: 1,
    activeAccountId,
    accounts,
    settings: defaultMachineSettings(),
  })
}

function machineFile(userData: string): string {
  return path.join(userData, 'machine.json')
}

function depsFor(userData: string, partial: Partial<AccountDeps> = {}): AccountDeps {
  return {
    userData,
    isUnlocked: () => false,
    lockSession: () => {},
    verifyPassword: () => false,
    openDatabase: () => 'ready',
    createEmpty: () => {},
    setup: () => {},
    closeDatabase: () => {},
    resetAccountFiles: () => {},
    ...partial,
  }
}

describe('accountService', () => {
  it('does not import electron, sql.js, database, or vaultService at the top level', () => {
    const source = fs.readFileSync(new URL('./accountService.ts', import.meta.url), 'utf8')
    const factoryAt = source.indexOf('function defaultAccountDeps')
    expect(factoryAt).toBeGreaterThan(0)
    const head = source.slice(0, factoryAt)
    expect(head).not.toMatch(/electron|sql\.js|database|vaultService/)
  })

  it('does not create an accounts directory when the name is blank', () => {
    const userData = tempUserData()
    const calls: string[] = []
    setActiveAccountId('stale')

    expect(() => createAccount(
      { name: '   ', masterPassword: 'secret', confirmPassword: 'secret' },
      depsFor(userData, {
        createEmpty: () => calls.push('create'),
        setup: () => calls.push('setup'),
      }),
    )).toThrow(/^ACCOUNT_NAME_EMPTY$/)

    expect(fs.existsSync(path.join(userData, 'accounts'))).toBe(false)
    expect(fs.existsSync(machineFile(userData))).toBe(false)
    expect(calls).toEqual([])
    expect(getActiveAccountId()).toBe('stale')
  })

  it('rejects an overlong name before creating a directory', () => {
    const userData = tempUserData()

    expect(() => createAccount(
      { name: 'a'.repeat(33), masterPassword: 'secret', confirmPassword: 'secret' },
      depsFor(userData),
    )).toThrow(/^ACCOUNT_NAME_TOO_LONG$/)

    expect(fs.existsSync(path.join(userData, 'accounts'))).toBe(false)
  })

  it('rejects a duplicate name before creating a directory', () => {
    const userData = tempUserData()
    writeDocument(userData, 'keep', [accountRecord('keep', '工作', 1)])
    const original = fs.readFileSync(machineFile(userData), 'utf8')

    expect(() => createAccount(
      { name: ' 工作 ', masterPassword: 'secret', confirmPassword: 'secret' },
      depsFor(userData),
    )).toThrow(/^ACCOUNT_NAME_EXISTS$/)

    expect(fs.existsSync(path.join(userData, 'accounts'))).toBe(false)
    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
  })

  it('removes the new directory and keeps the original active account when setup throws', () => {
    const userData = tempUserData()
    writeDocument(userData, 'keep', [accountRecord('keep', '工作', 1)])
    const original = fs.readFileSync(machineFile(userData), 'utf8')
    fs.mkdirSync(path.join(userData, 'accounts', 'keep'), { recursive: true })
    fs.writeFileSync(path.join(userData, 'accounts', 'keep', 'pwdbook.db'), 'keep-db')
    setActiveAccountId('stale')
    const opened: string[] = []

    expect(() => createAccount(
      { name: '家庭', masterPassword: 'secret', confirmPassword: 'secret' },
      depsFor(userData, {
        createEmpty: (file) => {
          expect(fs.existsSync(path.dirname(file))).toBe(true)
          fs.writeFileSync(file, 'new-db')
        },
        setup: () => {
          const names = fs.readdirSync(path.join(userData, 'accounts'))
          expect(names).toContain('keep')
          expect(names).toHaveLength(2)
          throw new Error('setup-failed')
        },
        openDatabase: (file) => {
          opened.push(file)
          return 'ready'
        },
      }),
    )).toThrow('setup-failed')

    expect(fs.readdirSync(path.join(userData, 'accounts'))).toEqual(['keep'])
    expect(fs.readFileSync(path.join(userData, 'accounts', 'keep', 'pwdbook.db'), 'utf8')).toBe('keep-db')
    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
    expect(opened).toEqual([path.join(userData, 'accounts', 'keep', 'pwdbook.db')])
    expect(getActiveAccountId()).toBe('keep')
  })

  it('creates an account, writes it last, and makes it active', () => {
    const userData = tempUserData()
    writeDocument(userData, 'keep', [accountRecord('keep', '工作', 1)])
    fs.mkdirSync(path.join(userData, 'accounts', 'keep'), { recursive: true })
    const createdFiles: string[] = []
    const setups: Array<[string, string]> = []
    const before = Date.now()

    const document = createAccount(
      { name: '  家庭 ', masterPassword: 'secret', confirmPassword: 'again' },
      depsFor(userData, {
        createEmpty: (file) => {
          createdFiles.push(file)
          fs.writeFileSync(file, 'new-db')
        },
        setup: (masterPassword, confirmPassword) => {
          setups.push([masterPassword, confirmPassword])
        },
      }),
    )

    const after = Date.now()
    const created = document.accounts[1]
    expect(document.activeAccountId).toBe(created?.id)
    expect(document.accounts[0]).toEqual(accountRecord('keep', '工作', 1))
    expect(created?.name).toBe('家庭')
    expect(created?.createdAt).toBeGreaterThanOrEqual(before)
    expect(created?.createdAt).toBeLessThanOrEqual(after)
    expect(createdFiles).toEqual([path.join(userData, 'accounts', created?.id ?? '', 'pwdbook.db')])
    expect(setups).toEqual([['secret', 'again']])
    expect(fs.existsSync(path.join(userData, 'accounts', created?.id ?? ''))).toBe(true)
    const saved = JSON.parse(fs.readFileSync(machineFile(userData), 'utf8')) as {
      activeAccountId: string
      accounts: AccountRecord[]
    }
    expect(saved.activeAccountId).toBe(created?.id)
    expect(saved.accounts.map((account) => account.name)).toEqual(['工作', '家庭'])
    expect(getActiveAccountId()).toBe(created?.id)
  })

  it('writes the target id, closes the current database, and opens the target', () => {
    const userData = tempUserData()
    writeDocument(userData, 'alpha', [
      accountRecord('alpha', '甲', 1),
      accountRecord('beta', '乙', 2),
    ])
    setActiveAccountId('stale')
    const events: string[] = []

    selectAccount('beta', depsFor(userData, {
      closeDatabase: () => {
        const saved = JSON.parse(fs.readFileSync(machineFile(userData), 'utf8')) as { activeAccountId: string }
        expect(saved.activeAccountId).toBe('beta')
        events.push('close')
      },
      openDatabase: (file) => {
        expect(events).toEqual(['close'])
        events.push(file)
        return 'ready'
      },
    }))

    expect(events).toEqual(['close', path.join(userData, 'accounts', 'beta', 'pwdbook.db')])
    expect(getActiveAccountId()).toBe('beta')
  })

  it('throws VAULT_FILE_DAMAGED and leaves the target active when the database is missing', () => {
    const userData = tempUserData()
    writeDocument(userData, 'alpha', [
      accountRecord('alpha', '甲', 1),
      accountRecord('beta', '乙', 2),
    ])
    setActiveAccountId('stale')

    expect(() => selectAccount('beta', depsFor(userData, {
      openDatabase: () => 'missing',
    }))).toThrow(/^VAULT_FILE_DAMAGED$/)

    const saved = JSON.parse(fs.readFileSync(machineFile(userData), 'utf8')) as { activeAccountId: string }
    expect(saved.activeAccountId).toBe('beta')
    expect(getActiveAccountId()).toBe('beta')
  })

  it('refuses to select an account while the vault is unlocked', () => {
    const userData = tempUserData()
    writeDocument(userData, 'alpha', [
      accountRecord('alpha', '甲', 1),
      accountRecord('beta', '乙', 2),
    ])
    const original = fs.readFileSync(machineFile(userData), 'utf8')
    const events: string[] = []

    expect(() => selectAccount('beta', depsFor(userData, {
      isUnlocked: () => true,
      closeDatabase: () => events.push('close'),
      openDatabase: () => {
        events.push('open')
        return 'ready'
      },
    }))).toThrow(/^VAULT_UNLOCK_REQUIRED$/)

    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
    expect(events).toEqual([])
  })

  it('rejects a duplicate rename without asking for a password', () => {
    const userData = tempUserData()
    writeDocument(userData, 'beta', [
      accountRecord('alpha', '工作', 1),
      accountRecord('beta', '家庭', 2),
    ])
    const original = fs.readFileSync(machineFile(userData), 'utf8')

    expect(() => renameAccount(' 工作 ', depsFor(userData, {
      verifyPassword: () => {
        throw new Error('password-checked')
      },
    }))).toThrow(/^ACCOUNT_NAME_EXISTS$/)

    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
  })

  it('refuses to delete the only account and leaves its directory', () => {
    const userData = tempUserData()
    writeDocument(userData, 'only', [accountRecord('only', '工作', 1)])
    const original = fs.readFileSync(machineFile(userData), 'utf8')
    const dir = path.join(userData, 'accounts', 'only')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'pwdbook.db'), 'only-db')

    expect(() => deleteAccount('secret', depsFor(userData, {
      verifyPassword: () => true,
    }))).toThrow(/^ACCOUNT_DELETE_LAST$/)

    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'pwdbook.db'), 'utf8')).toBe('only-db')
    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
    expect(fs.existsSync(`${dir}.deleting`)).toBe(false)
  })

  it('deletes the active account and activates the first remaining account', () => {
    const userData = tempUserData()
    writeDocument(userData, 'alpha', [
      accountRecord('alpha', '甲', 1),
      accountRecord('beta', '乙', 2),
    ])
    const alphaDir = path.join(userData, 'accounts', 'alpha')
    const betaDir = path.join(userData, 'accounts', 'beta')
    fs.mkdirSync(alphaDir, { recursive: true })
    fs.mkdirSync(betaDir, { recursive: true })
    fs.writeFileSync(path.join(alphaDir, 'pwdbook.db'), 'alpha-db')
    fs.writeFileSync(path.join(betaDir, 'pwdbook.db'), 'beta-db')
    setActiveAccountId('stale')
    const events: string[] = []

    const document = deleteAccount('secret', depsFor(userData, {
      verifyPassword: (password) => password === 'secret',
      lockSession: () => {
        expect(fs.existsSync(alphaDir)).toBe(true)
        events.push('lock')
      },
      closeDatabase: () => {
        expect(events).toEqual(['lock'])
        expect(fs.existsSync(alphaDir)).toBe(true)
        events.push('close')
      },
      openDatabase: (file) => {
        expect(fs.existsSync(alphaDir)).toBe(false)
        expect(fs.existsSync(`${alphaDir}.deleting`)).toBe(false)
        events.push(file)
        return 'ready'
      },
    }))

    expect(events).toEqual(['lock', 'close', path.join(betaDir, 'pwdbook.db')])
    expect(document.activeAccountId).toBe('beta')
    expect(document.accounts.map((account) => account.id)).toEqual(['beta'])
    expect(fs.existsSync(betaDir)).toBe(true)
    expect(fs.readFileSync(path.join(betaDir, 'pwdbook.db'), 'utf8')).toBe('beta-db')
    const saved = JSON.parse(fs.readFileSync(machineFile(userData), 'utf8')) as {
      activeAccountId: string
      accounts: AccountRecord[]
    }
    expect(saved.activeAccountId).toBe('beta')
    expect(saved.accounts.map((account) => account.id)).toEqual(['beta'])
    expect(getActiveAccountId()).toBe('beta')
  })

  it('changes nothing when the password is wrong', () => {
    const userData = tempUserData()
    writeDocument(userData, 'alpha', [
      accountRecord('alpha', '甲', 1),
      accountRecord('beta', '乙', 2),
    ])
    const original = fs.readFileSync(machineFile(userData), 'utf8')
    const alphaDir = path.join(userData, 'accounts', 'alpha')
    const betaDir = path.join(userData, 'accounts', 'beta')
    fs.mkdirSync(alphaDir, { recursive: true })
    fs.mkdirSync(betaDir, { recursive: true })
    fs.writeFileSync(path.join(alphaDir, 'keep.txt'), 'stay')
    setActiveAccountId('stale')
    const events: string[] = []

    expect(() => deleteAccount('nope', depsFor(userData, {
      verifyPassword: () => false,
      lockSession: () => events.push('lock'),
      closeDatabase: () => events.push('close'),
    }))).toThrow(/^WRONG_MASTER_PASSWORD$/)

    expect(events).toEqual([])
    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
    expect(fs.readFileSync(path.join(alphaDir, 'keep.txt'), 'utf8')).toBe('stay')
    expect(fs.existsSync(betaDir)).toBe(true)
    expect(fs.existsSync(`${alphaDir}.deleting`)).toBe(false)
    expect(getActiveAccountId()).toBe('stale')
  })

  it('rebuilds an empty database for the active account while the session is locked', () => {
    const userData = tempUserData()
    writeDocument(userData, 'keep', [accountRecord('keep', '工作', 1)])
    const original = fs.readFileSync(machineFile(userData), 'utf8')
    const dir = path.join(userData, 'accounts', 'keep')
    fs.mkdirSync(dir, { recursive: true })
    const calls: string[] = []

    rebuildEmptyVault(depsFor(userData, {
      resetAccountFiles: (accountDir) => calls.push(`reset:${accountDir}`),
      createEmpty: (file) => calls.push(`empty:${file}`),
    }))

    expect(calls).toEqual([
      `reset:${dir}`,
      `empty:${path.join(dir, 'pwdbook.db')}`,
    ])
    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('refuses to rebuild an empty vault while the session is unlocked', () => {
    const userData = tempUserData()
    writeDocument(userData, 'keep', [accountRecord('keep', '工作', 1)])
    const original = fs.readFileSync(machineFile(userData), 'utf8')
    const calls: string[] = []

    expect(() => rebuildEmptyVault(depsFor(userData, {
      isUnlocked: () => true,
      resetAccountFiles: () => calls.push('reset'),
      createEmpty: () => calls.push('empty'),
    }))).toThrow(/^VAULT_UNLOCK_REQUIRED$/)

    expect(calls).toEqual([])
    expect(fs.readFileSync(machineFile(userData), 'utf8')).toBe(original)
  })
})
