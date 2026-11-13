# 本地账号 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一台电脑上维护多个本地账号，每个账号是独立主密码的保险库，切换时只打开该账号的数据。

**Architecture:** `{userData}/machine.json` 保存账号名单和本机设置。每个账号使用 `accounts/{id}/` 下自己的 `pwdbook.db`、附件和同步目录。启动时先决定名单，再只打开活动账号的库。会话密钥只属于当前解锁的账号。锁定沿用现有收窗顺序，并按账号丢掉窗口恢复记忆、剪切板历史和同步任务。

**Tech Stack:** Electron 35、Vue 3、TypeScript、sql.js、Vue I18n、Vitest、Node `fs`。

## Global Constraints

- 账号是本地命名保险库，不连接服务器，不做远程登录。
- 每个账号有自己的主密码。切换时先锁定，再用目标账号的主密码解锁。
- 显示名去掉首尾空白后必须非空，最长 32 个 Unicode 码位，与已有显示名完全相同则拒绝，比较区分大小写。
- 主密码至少 4 位，两次输入必须一致。
- 密码、附件、便签、剪切板历史、分类、回收站、同步配置按账号隔离。
- 语言、主题、全局快捷键、开机启动、关窗行为留在本机。主题继续用现有 `localStorage`。
- 锁定界面可以新建账号和选择已有账号。删除只能在该账号解锁后进行，并再输入一次主密码。至少保留一个账号。
- 每个账号一个目录。同一时刻只打开活动账号的数据库。内存里只有一把会话密钥，并记下它属于哪个账号。
- `machine.json` 最后写入。迁移后的第一个账号显示名固定为「默认账号」。
- 剪切板历史今天写在渲染进程的全局 `localStorage` / `sessionStorage` 键上，必须改成带账号 id 的键。
- 文件夹同步没有文件监听器，只有 3 秒延迟发布。锁定时取消这个定时器，并停止 Wi-Fi 同步服务。

## File structure

- Create `src/shared/accountName.ts`：显示名校验。
- Create `src/shared/machineDocument.ts`：名单文档、本机设置、从旧库抄出的键。
- Create `src/shared/clipboardStorageKeys.ts`：剪切板存储键。
- Create `src/main/accounts/machineStore.ts`：读写 `machine.json`。
- Create `src/main/accounts/startup.ts`：启动顺序、迁移和残留目录。
- Create `src/main/accounts/accountService.ts`：新建、选择、改名、删除、重建空库。
- Modify `src/main/db/database.ts`：库路径跟随活动账号；损坏时不建替身空库。
- Modify `src/main/services/sessionService.ts`：会话密钥绑定账号 id。
- Modify `src/main/services/settingsService.ts`、`src/main/tray.ts`、`src/main/services/nativeHostRegistryService.ts`：本机键只读写名单文件。
- Modify `src/main/ipc/handlers.ts`、`src/main/noteWindows.ts`、`src/main/services/folderSyncService.ts`：切换收口。
- Modify `src/components/LockScreen.vue`、`src/components/SettingsView.vue`、`src/components/TitleBar.vue`、`src/components/ClipboardWindowApp.vue`、`src/App.vue`。

---

### Task 1: 显示名与名单文档

**Files:**
- Create: `src/shared/accountName.ts`
- Create: `src/shared/accountName.test.ts`
- Create: `src/shared/machineDocument.ts`
- Create: `src/shared/machineDocument.test.ts`
- Modify: `src/shared/errors.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `normalizeAccountName(name: string): string`
  - `validateAccountName(name: string, existingNames: readonly string[]): 'empty' | 'too-long' | 'duplicate' | null`
  - `ACCOUNT_NAME_MAX_CODE_POINTS = 32`
  - `DEFAULT_ACCOUNT_NAME = '默认账号'`
  - `MachineSettings`, `MachineDocument`, `defaultMachineSettings(): MachineSettings`
  - `parseMachineDocument(raw: unknown): MachineDocument | null`
  - `MACHINE_DB_KEYS: readonly string[]`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { validateAccountName } from './accountName'

describe('validateAccountName', () => {
  it('rejects blank, overlong and exact duplicates', () => {
    expect(validateAccountName('   ', [])).toBe('empty')
    expect(validateAccountName('a'.repeat(33), [])).toBe('too-long')
    expect(validateAccountName(' 工作 ', ['工作'])).toBe('duplicate')
    expect(validateAccountName('Work', ['work'])).toBeNull()
  })

  it('counts unicode code points', () => {
    expect(validateAccountName('😀'.repeat(32), [])).toBeNull()
    expect(validateAccountName('😀'.repeat(33), [])).toBe('too-long')
  })
})
```

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_NAME, parseMachineDocument } from './machineDocument'

describe('parseMachineDocument', () => {
  it('accepts version 1 and rejects a missing active id', () => {
    const parsed = parseMachineDocument({
      version: 1,
      activeAccountId: 'a',
      accounts: [{ id: 'a', name: DEFAULT_ACCOUNT_NAME, createdAt: 1 }],
      settings: {},
    })
    expect(parsed?.activeAccountId).toBe('a')
    expect(parsed?.settings.uiLocale).toBe('zh-CN')
    expect(parseMachineDocument({ version: 1, accounts: [], settings: {} })).toBeNull()
    expect(parseMachineDocument({
      version: 1,
      activeAccountId: 'missing',
      accounts: [{ id: 'a', name: DEFAULT_ACCOUNT_NAME, createdAt: 1 }],
      settings: {},
    })?.activeAccountId).toBe('missing')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/accountName.test.ts src/shared/machineDocument.test.ts`
Expected: FAIL with cannot find module

- [x] **Step 3: Write minimal implementation**

`src/shared/errors.ts` 追加：

```ts
ACCOUNT_NAME_EMPTY: 'ACCOUNT_NAME_EMPTY',
ACCOUNT_NAME_TOO_LONG: 'ACCOUNT_NAME_TOO_LONG',
ACCOUNT_NAME_EXISTS: 'ACCOUNT_NAME_EXISTS',
ACCOUNT_DELETE_LAST: 'ACCOUNT_DELETE_LAST',
ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
MACHINE_REGISTRY_DAMAGED: 'MACHINE_REGISTRY_DAMAGED',
VAULT_FILE_DAMAGED: 'VAULT_FILE_DAMAGED',
```

`src/shared/accountName.ts`：

```ts
export const ACCOUNT_NAME_MAX_CODE_POINTS = 32

export function normalizeAccountName(name: string): string {
  return name.trim()
}

export function validateAccountName(
  name: string,
  existingNames: readonly string[],
): 'empty' | 'too-long' | 'duplicate' | null {
  const normalized = normalizeAccountName(name)
  if (normalized.length === 0) return 'empty'
  if ([...normalized].length > ACCOUNT_NAME_MAX_CODE_POINTS) return 'too-long'
  if (existingNames.includes(normalized)) return 'duplicate'
  return null
}
```

`src/shared/machineDocument.ts`：

```ts
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

export function parseMachineDocument(raw: unknown): MachineDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Partial<MachineDocument>
  if (body.version !== 1 || typeof body.activeAccountId !== 'string') return null
  if (!Array.isArray(body.accounts)) return null
  const accounts = body.accounts.filter((item): item is AccountRecord =>
    Boolean(item) && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.createdAt === 'number')
  if (accounts.length !== body.accounts.length) return null
  const defaults = defaultMachineSettings()
  const settings = (body.settings ?? {}) as Partial<MachineSettings>
  return {
    version: 1,
    activeAccountId: body.activeAccountId,
    accounts,
    settings: {
      ...defaults,
      ...settings,
      uiLocale: settings.uiLocale === 'en' ? 'en' : defaults.uiLocale,
      closeWindowAction: settings.closeWindowAction === 'tray' || settings.closeWindowAction === 'quit' ? settings.closeWindowAction : 'ask',
      launchAtLoginEnabled: asBoolean(settings.launchAtLoginEnabled, defaults.launchAtLoginEnabled),
      quickBarEnabled: asBoolean(settings.quickBarEnabled, defaults.quickBarEnabled),
      mainWindowShortcutEnabled: asBoolean(settings.mainWindowShortcutEnabled, defaults.mainWindowShortcutEnabled),
      notesManagerShortcutEnabled: asBoolean(settings.notesManagerShortcutEnabled, defaults.notesManagerShortcutEnabled),
    },
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/accountName.test.ts src/shared/machineDocument.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/shared/accountName.ts src/shared/accountName.test.ts src/shared/machineDocument.ts src/shared/machineDocument.test.ts src/shared/errors.ts
git commit -m "feat: 增加本地账号名称和名单文档"
```

---

### Task 2: 启动决策与迁移

**Files:**
- Create: `src/main/accounts/startup.ts`
- Create: `src/main/accounts/startup.test.ts`

**Interfaces:**
- Consumes: `parseMachineDocument`, `defaultMachineSettings`, `DEFAULT_ACCOUNT_NAME`, `MACHINE_DB_KEYS`
- Produces:
  - `bootAccounts(userData: string, now?: () => number, createId?: () => string): BootResult`
  - `BootResult = { kind: 'ready'; document: MachineDocument; warning: 'delete-incomplete' | null } | { kind: 'fresh' } | { kind: 'blocked'; reason: 'registry-corrupt' | 'registry-inconsistent' | 'ambiguous-accounts' }`

- [x] **Step 1: Write the failing test**

用 `fs.mkdtempSync` 做临时 `userData`。覆盖：

- 根目录有有效 `pwdbook.db`、`attachments/keep.txt`、`sync-server/a.txt`、`wifi-sync-certs/c.txt`，以及 `native-host/keep.txt`。`app_settings` 里有 `ui_locale=en` 和 `master_salt=abc`。启动后四类账号文件进入 `accounts/{id}/`，`native-host` 仍在根目录，`machine.json` 的名称是「默认账号」，`ui_locale` 已从库中删除，`master_salt` 还在。再调用一次 `bootAccounts`，目录不再变化。
- 只有 `accounts/orphan/pwdbook.db` 且没有 `machine.json` 时，登记为「默认账号」。
- 两个未登记库时返回 `ambiguous-accounts`，不写 `machine.json`。
- 损坏的根目录 `pwdbook.db`（内容为 `not-sqlite`）被改名为 `pwdbook.db.corrupt-*`，结果是 `fresh`。
- 无法解析的 `machine.json` 被隔离；旁边已有账号库时返回 `registry-corrupt`，不新建库。
- 能解析但 `activeAccountId` 不在名单中时返回 `registry-inconsistent`，原文件保留，不改名为 `.corrupt-*`。`parseMachineDocument` 必须返回这份文档，不能把它当成无法解析。
- 名单已不含某 id，但 `accounts/{id}.deleting` 还在：启动后该目录消失。
- 名单仍含该 id，目录在 `.deleting`：启动后目录改回 `accounts/{id}`，`warning` 为 `delete-incomplete`。

测试里用 sql.js 写最小库：

```ts
import initSqlJs from 'sql.js'
import path from 'path'

async function writeSettingsDb(file: string, rows: Record<string, string>): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm') })
  const db = new SQL.Database()
  db.run('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)')
  for (const [key, value] of Object.entries(rows)) {
    db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', [key, value])
  }
  fs.writeFileSync(file, Buffer.from(db.export()))
}
```

有效文件头也可以直接用这段 helper。`bootAccounts` 对根目录库先检查 16 字节头 `SQLite format 3\0`，头不对就隔离，不打开。

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/accounts/startup.test.ts`
Expected: FAIL with cannot find module

- [x] **Step 3: Write minimal implementation**

`bootAccounts` 按规格第 6 节的顺序执行，并且：

1. 先清理 `.deleting` 残留，再读 `machine.json`。
2. 迁移时生成 id，把 `pwdbook.db`、`attachments`、`sync-server`、`wifi-sync-certs` 用 `fs.renameSync` 移入 `accounts/{id}/`。目录不存在就跳过。
3. 用 sql.js 打开移入后的库，读取 `MACHINE_DB_KEYS`，缺键时用 `defaultMachineSettings()`。`auto_update_enabled` 只有值为 `true` 或 `false` 才写入 `settings.autoUpdateEnabled`。然后 `DELETE FROM app_settings WHERE key = ?` 并落盘。
4. 最后 `fs.writeFileSync` 写 `machine.json`。写之前任何 rename 抛错都向外抛，不写名单。
5. 孤儿目录只在没有 `machine.json`、没有根目录 `pwdbook.db`、且恰好一个 `accounts/*/pwdbook.db` 时登记。id 用该目录名。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/accounts/startup.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/main/accounts/startup.ts src/main/accounts/startup.test.ts
git commit -m "feat: 启动时把现有库迁成默认账号"
```

---

### Task 3: 数据库只打开活动账号

**Files:**
- Modify: `src/main/db/database.ts`
- Create: `src/main/db/databasePath.test.ts`
- Modify: `src/main/services/attachmentService.ts`
- Modify: `src/main/services/wifiSyncService.ts`
- Modify: `src/main/services/syncBundleService.ts`

**Interfaces:**
- Consumes: 活动账号目录字符串
- Produces:
  - `setDatabaseFile(filePath: string): void`
  - `getDatabaseFile(): string`
  - `initDatabase(): Promise<Database>` 在文件缺失或文件头损坏时抛 `VaultFileDamagedError`，不创建空库
  - `createEmptyDatabase(): Promise<Database>`
  - `VaultFileDamagedError.quarantinedPath: string | null`
  - `resetDatabaseFile()` 删除当前库、`attachments`、`sync-server`、`wifi-sync-certs`，不删除账号目录和 `machine.json`

- [x] **Step 1: Write the failing test**

把 `isValidSqliteHeader` 和路径拼接抽成不依赖 Electron 的纯函数再测：

```ts
import { describe, expect, it } from 'vitest'
import { accountDataPaths, isValidSqliteHeader } from '../accounts/accountPaths'

describe('account paths', () => {
  it('keeps native host at the user data root', () => {
    const paths = accountDataPaths('C:/data', 'acc-1')
    expect(paths.database).toBe('C:/data/accounts/acc-1/pwdbook.db')
    expect(paths.nativeHost).toBe('C:/data/native-host')
    expect(isValidSqliteHeader(Buffer.from('SQLite format 3\0'))).toBe(true)
    expect(isValidSqliteHeader(Buffer.from('nope'))).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/db/databasePath.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

新建 `src/main/accounts/accountPaths.ts`：

```ts
import path from 'path'

const SQLITE_HEADER = 'SQLite format 3\u0000'

export function isValidSqliteHeader(buffer: Buffer): boolean {
  return buffer.length >= 16 && buffer.subarray(0, 16).toString('binary') === SQLITE_HEADER
}

export function accountDataPaths(userData: string, accountId: string) {
  const dir = path.join(userData, 'accounts', accountId)
  return {
    dir,
    database: path.join(dir, 'pwdbook.db'),
    attachments: path.join(dir, 'attachments'),
    syncServer: path.join(dir, 'sync-server'),
    wifiCerts: path.join(dir, 'wifi-sync-certs'),
    nativeHost: path.join(userData, 'native-host'),
    nativeBridge: path.join(userData, 'native-bridge.json'),
  }
}
```

`database.ts` 删除写死的 `path.join(app.getPath('userData'), 'pwdbook.db')`。`setDatabaseFile` 在已有连接时先 `closeDatabase()`。`initDatabase` 读 `getDatabaseFile()`：文件不存在，或头无效并已改名为 `pwdbook.db.corrupt-{timestamp}` 时，抛出 `VaultFileDamagedError`。`createEmptyDatabase` 才执行现在的建表和 `seedAndMigrateCategories`。

`attachmentService.ts` 的附件目录、`wifiSyncService.ts` 的 `getCertDir()`、`syncBundleService.ts` 的 `sync-server` 改为 `accountDataPaths(app.getPath('userData'), getActiveAccountId())`。`getActiveAccountId()` 在 Task 6 提供；本任务先从 `src/main/accounts/activeAccount.ts` 导出一个内存值 `setActiveAccountId` / `getActiveAccountId`，避免循环依赖数据库。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/db/databasePath.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/main/accounts/accountPaths.ts src/main/accounts/activeAccount.ts src/main/db/database.ts src/main/db/databasePath.test.ts src/main/services/attachmentService.ts src/main/services/wifiSyncService.ts src/main/services/syncBundleService.ts
git commit -m "feat: 数据库和附件改到活动账号目录"
```

---

### Task 4: 本机设置与账号设置分开读写

**Files:**
- Create: `src/main/accounts/machineStore.ts`
- Modify: `src/main/services/settingsService.ts`
- Modify: `src/main/services/settingsService.test.ts`
- Modify: `src/main/tray.ts`
- Modify: `src/main/ipc/handlers.ts` 里写 `ui_locale` 的那一处
- Modify: `src/main/services/nativeHostRegistryService.ts`

**Interfaces:**
- Consumes: `MachineDocument`, `MachineSettings`
- Produces:
  - `readMachineDocument(userData: string): MachineDocument | null`
  - `writeMachineDocument(userData: string, document: MachineDocument): void`
  - `updateMachineSettings(partial: Partial<MachineSettings>): MachineSettings`
  - `getSecuritySettings()` 仍返回现在的 `SecuritySettings`。语言、快捷键、开机启动、关窗行为来自 `machine.json`；自动锁定、剪切板行为、`quickBarRecentLimit`、`browserFillEnabled`、`trashRetentionDays` 来自当前账号库。

- [x] **Step 1: Write the failing test**

扩展 `settingsService.test.ts`：mock `updateMachineSettings` 和 `readMachineDocument`。写入 `closeWindowAction: 'quit'` 后，mock 的数据库 map 里没有 `close_window_action`，mock 的 machine settings 里有。写入 `autoLockMinutes: 5` 后，只出现在数据库 map。

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/settingsService.test.ts`
Expected: FAIL，因为关窗行为仍写进 `setSetting`

- [x] **Step 3: Write minimal implementation**

`machineStore.ts` 用 `path.join(userData, 'machine.json')`，`JSON.parse` 失败返回 `null`。写入使用临时文件加 `fs.renameSync`。

`settingsService.ts` 把这些字段的 `getSetting` / `setSetting` 换成 machine store：

- `launchAtLoginEnabled`
- `closeWindowAction`
- `quickBarEnabled`
- `quickBarAccelerator`
- `mainWindowShortcutEnabled`
- `mainWindowShortcutAccelerator`
- `notesManagerShortcutEnabled`
- `notesManagerAccelerator`
- `clipboardAccelerator`

其余字段继续走 `getSetting` / `setSetting`。

`tray.ts` 的 `getSetting(UI_LOCALE_SETTING_KEY)` 改为 `readMachineDocument(...).settings.uiLocale`。`handlers.ts` 里 `setSetting(UI_LOCALE_SETTING_KEY, next)` 改为 `updateMachineSettings({ uiLocale: next })`。

`nativeHostRegistryService.ts` 的 `browser_extension_id` 改为 `settings.browserExtensionId`。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/services/settingsService.test.ts`
Expected: PASS，并且现有「没有 autoUpdateEnabled 字段」的测试仍然通过

- [x] **Step 5: Commit**

```bash
git add src/main/accounts/machineStore.ts src/main/services/settingsService.ts src/main/services/settingsService.test.ts src/main/tray.ts src/main/ipc/handlers.ts src/main/services/nativeHostRegistryService.ts
git commit -m "feat: 本机设置改从账号名单读取"
```

---

### Task 5: 账号新建、选择、改名、删除和重建

**Files:**
- Create: `src/main/accounts/accountService.ts`
- Create: `src/main/accounts/accountService.test.ts`

**Interfaces:**
- Consumes: `validateAccountName`, `bootAccounts`, `setDatabaseFile`, `createEmptyDatabase`, `initDatabase`, `closeDatabase`, `resetDatabaseFile`, `setupVault`, `verifyMasterPassword`
- Produces:
  - `createAccount(input: { name: string; masterPassword: string; confirmPassword: string }): MachineDocument`
  - `selectAccount(accountId: string): void`
  - `renameAccount(name: string): AccountRecord`
  - `deleteAccount(masterPassword: string): MachineDocument`
  - `rebuildEmptyVault(): void`

- [x] **Step 1: Write the failing test**

测试注入文件操作和密码校验，不启动 Electron。覆盖这些结果：

- 名称为空时不创建 `accounts/` 目录。
- 创建失败时删除新目录，原来的 `activeAccountId` 不变。
- `selectAccount` 把 `activeAccountId` 写成目标 id，并调用关闭旧库、打开新库。目标库缺失时抛 `VAULT_FILE_DAMAGED`，`activeAccountId` 仍是目标 id。
- 改名不要求密码；重名抛 `ACCOUNT_NAME_EXISTS`。
- 只剩一个账号时 `deleteAccount` 抛 `ACCOUNT_DELETE_LAST`，目录还在。
- 两个账号且密码正确时，目录改名为 `.deleting`，名单去掉该 id，活动 id 变为名单第一项，然后 `.deleting` 被删除。
- 密码错误时目录和名单不变。

密码校验用注入的 `verify(password: string): boolean`。数据库开关用注入的 `open(file: string): 'ready' | 'missing'`。

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/accounts/accountService.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

`createAccount`：先 `validateAccountName`。失败映射到 `ACCOUNT_NAME_EMPTY`、`ACCOUNT_NAME_TOO_LONG`、`ACCOUNT_NAME_EXISTS`。通过后再 `fs.mkdirSync`，`setDatabaseFile`，`createEmptyDatabase`，`setupVault`。最后把账号追加进文档并写 `machine.json`。`setupVault` 或写文件抛错时 `fs.rmSync` 新目录，重新打开原来的活动库。

`selectAccount` 在会话已解锁时抛 `VAULT_UNLOCK_REQUIRED`。先写 `activeAccountId`，再关闭并打开目标库。

`deleteAccount` 用当前库的 `master_salt` / `master_hash` 调用 `verifyMasterPassword`。失败抛 `WRONG_MASTER_PASSWORD`。成功后按规格第 4.2 节四步执行。`rebuildEmptyVault` 调用扩展后的 `resetDatabaseFile()`，再 `createEmptyDatabase()`，不改账号记录。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/accounts/accountService.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/main/accounts/accountService.ts src/main/accounts/accountService.test.ts
git commit -m "feat: 支持本地账号的新建选择改名和删除"
```

---

### Task 6: 切换时收起窗口、剪切板和同步

**Files:**
- Modify: `src/main/services/sessionService.ts`
- Modify: `src/main/noteWindows.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/services/folderSyncService.ts`
- Create: `src/main/accounts/lockBoundary.test.ts`
- Create: `src/shared/clipboardStorageKeys.ts`
- Create: `src/shared/clipboardStorageKeys.test.ts`
- Modify: `src/components/ClipboardWindowApp.vue`

**Interfaces:**
- Consumes: `getActiveAccountId`
- Produces:
  - `unlockSession(key, transportKey, accountId: string)`
  - `getSessionAccountId(): string | null`
  - `rememberLockedAccount(accountId: string): void`
  - `shouldRestoreLockedWindows(unlockAccountId: string): boolean`
  - `cancelPendingFolderSync(): void`
  - `clearCopiedSecretIfPresent(): void`
  - `clipboardStorageKeys(accountId: string): { session: string; persistent: string; favorites: string }`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { clipboardStorageKeys } from './clipboardStorageKeys'

it('namespaces clipboard storage by account', () => {
  expect(clipboardStorageKeys('acc-a').persistent).toBe('pwdbook-clipboard-history:acc-a')
  expect(clipboardStorageKeys('acc-a').persistent).not.toBe(clipboardStorageKeys('acc-b').persistent)
})
```

```ts
import { describe, expect, it } from 'vitest'
import { rememberLockedAccount, shouldRestoreLockedWindows } from '../noteWindows'

it('restores locked windows only for the same account', () => {
  rememberLockedAccount('acc-a')
  expect(shouldRestoreLockedWindows('acc-a')).toBe(true)
  expect(shouldRestoreLockedWindows('acc-b')).toBe(false)
})
```

`shouldRestoreLockedWindows` 在返回 false 时清空 `visibleBeforeLock` 和 `managerVisibleBeforeLock`。

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/clipboardStorageKeys.test.ts src/main/accounts/lockBoundary.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

`lockSession` 同时把 `sessionAccountId` 置空。`unlockSession` 记录账号 id。

`handlers.ts` 的 `copySecret` 记下 `lastCopiedSecret`。新增：

```ts
export function clearCopiedSecretIfPresent(): void {
  if (lastCopiedSecret !== null && clipboard.readText() === lastCopiedSecret) clipboard.clear()
  lastCopiedSecret = null
  if (clipboardTimer) clearTimeout(clipboardTimer)
  clipboardTimer = null
}
```

`vaultLock` 顺序改为：`requestNoteDraftFlush`、`rememberLockedAccount(getSessionAccountId() ?? getActiveAccountId())`、`hideQuickBarOnLock`、`hideClipboardWindowOnLock`、`hideDetailWindowOnLock`、`hideNoteWindowsOnLock`、`clearCopiedSecretIfPresent`、`cancelPendingFolderSync`、`stopWifiSyncServer`、`lockVault`。`vaultUnlock` 只有 `shouldRestoreLockedWindows(getActiveAccountId())` 为真时调用现在的 `restoreNoteWindowsAfterUnlock()`；否则先清空锁定前的窗口记忆，再只对 `listDesktopVisibleNoteIds()` 调用 `openNoteWindow`。浏览器填充继续使用现有的解锁检查，解锁后只查询这一份已经打开的库。

`ClipboardWindowApp.vue` 去掉三个全局常量，改为 `clipboardStorageKeys(accountId)`。账号 id 来自新增的 `vaultApi.getBootState().activeAccountId`。收到 `accountChanged` 时先把当前列表写回旧键，再清空内存列表并读取新键。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/clipboardStorageKeys.test.ts src/main/accounts/lockBoundary.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/main/services/sessionService.ts src/main/noteWindows.ts src/main/ipc/handlers.ts src/main/services/folderSyncService.ts src/main/accounts/lockBoundary.test.ts src/shared/clipboardStorageKeys.ts src/shared/clipboardStorageKeys.test.ts src/components/ClipboardWindowApp.vue
git commit -m "feat: 切换账号时隔离窗口剪切板和同步"
```

---

### Task 7: IPC、启动入口和状态

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/preload/api.ts`
- Modify: `src/env.d.ts`
- Modify: `src/services/vaultApi.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/composables/useAppState.ts`

**Interfaces:**
- Consumes: Task 2 到 Task 6 的函数
- Produces:
  - `BootState`
  - `IPC.accountsCreate = 'accounts:create'`
  - `IPC.accountsSelect = 'accounts:select'`
  - `IPC.accountsRename = 'accounts:rename'`
  - `IPC.accountsDelete = 'accounts:delete'`
  - `IPC.accountsRebuild = 'accounts:rebuild'`
  - `vaultApi.createAccount`、`selectAccount`、`renameAccount`、`deleteAccount`、`rebuildVault`、`getBootState`

`BootState`：

```ts
export interface BootState {
  blocked: null | 'registry-corrupt' | 'registry-inconsistent' | 'ambiguous-accounts'
  warning: null | 'delete-incomplete'
  accounts: { id: string; name: string }[]
  activeAccountId: string | null
  activeAccountName: string | null
  vaultFile: 'ready' | 'missing' | 'corrupt'
  quarantinedPath: string | null
}
```

- [x] **Step 1: Write the failing test**

在 `src/shared/accountIpc.test.ts` 断言六个 IPC 常量的字符串，防止渲染进程和主进程写错通道名。

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/accountIpc.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

`index.ts` 在 `initDatabase()` 之前调用 `bootAccounts(app.getPath('userData'))`。`fresh` 不打开库。`ready` 时 `setActiveAccountId`、`setDatabaseFile`，再 `initDatabase()`；捕获 `VaultFileDamagedError` 后把 `vaultFile` 设为 `missing` 或 `corrupt`。`blocked` 时不打开库，窗口仍创建。

五个 handler 分别调用 Task 5 的函数。`accounts:create` 和 `accounts:select` 不要求已解锁。`accounts:rename` 和 `accounts:delete` 要求已解锁。`accounts:rebuild` 只在当前 `vaultFile !== 'ready'` 且会话已锁定时允许。清除保险库继续走现有 `vault:reset`：扩展后的 `resetDatabaseFile()` 清掉该账号的库、附件和同步目录，账号记录保留，然后 `createEmptyDatabase()`。

浏览器填充不新增查询路径。锁定时现有桥接返回未解锁；解锁后只读当前打开的那一个库。

`bootAccounts` 的 `BootResult` 映射到 `BootState`：`fresh` 变成 `blocked: null`、`accounts: []`、`vaultFile: 'missing'`；`blocked` 原样写入 `blocked`；`ready` 写入账号列表。库文件打不开时另外把 `vaultFile` 设为 `missing` 或 `corrupt`。

`useAppState` 增加 `bootState`。`lock()` 之后重新 `getBootState()`，使名单和活动账号刷新。`AppScreen` 增加 `'boot-error'`。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/accountIpc.test.ts src/main/accounts/startup.test.ts src/main/accounts/accountService.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/accountIpc.test.ts src/preload/api.ts src/env.d.ts src/services/vaultApi.ts src/main/ipc/handlers.ts src/main/index.ts src/composables/useAppState.ts
git commit -m "feat: 暴露本地账号的启动状态和操作"
```

---

### Task 8: 锁定界面、设置和标题栏

**Files:**
- Modify: `src/components/LockScreen.vue`
- Modify: `src/components/SettingsView.vue`
- Modify: `src/components/TitleBar.vue`
- Modify: `src/App.vue`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `src/i18n/locales/en.ts`
- Modify: `docs/code-map/database-schema.md`

**Interfaces:**
- Consumes: `vaultApi.createAccount`、`selectAccount`、`renameAccount`、`deleteAccount`、`rebuildVault`、`getBootState`、现有 `setupVault`、`unlock`、`lock`

- [x] **Step 1: Write the failing test**

给 `LockScreen` 抽出纯函数，放在 `src/components/lockScreenMode.ts`：

```ts
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
```

测试：没有账号时是 `boot-empty`；已有账号但正在新建时是 `create-account`；活动账号未初始化时是 `setup-password`；已初始化时是 `unlock`。

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/lockScreenMode.test.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

`LockScreen.vue`：

- `boot-empty` 和 `create-account` 显示名称输入、主密码、确认主密码，提交 `createAccount`。
- `unlock` 显示账号按钮列表。当前 `activeAccountId` 带选中样式。点击另一项调用 `selectAccount`，清空密码框。
- 列表下保留「新建账号」，进入 `create-account`，不要求先解锁。
- `vaultFile !== 'ready'` 时隐藏密码框，显示隔离路径，并提供「为该账号重建空库」。确认后调用 `rebuildVault`，界面进入 `setup-password`。
- 恢复密钥、重置主密码、清除保险库仍使用现在的组件，作用在已经 `selectAccount` 打开的库上。

`App.vue` 在 `bootState.blocked !== null` 时渲染一个错误页，而不是锁定表单。三份文案分别说明名单损坏但目录还在、活动账号不在名单中、发现多个未登记库。页面没有新建按钮。

`SettingsView.vue` 增加账号区：当前名称、改名输入、切换按钮、删除按钮。只剩一个账号时删除按钮禁用。删除前再输入主密码。切换按钮调用现有 `lock()`。

`TitleBar.vue` 在非详情窗显示 `bootState.activeAccountName`。点击调用 `lock()`。锁定页不显示这个按钮。

中文和英文都增加这些字符串：账号、新建账号、账号名称、切换账号、删除账号、最后一个账号不能删除、库文件已损坏、为该账号重建空库、名单文件已损坏、删除未完成。

`docs/code-map/database-schema.md` 开头的数据库路径改为 `{userData}/accounts/{accountId}/pwdbook.db`，并写明本机键位于 `machine.json`。

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/lockScreenMode.test.ts src/shared/accountName.test.ts src/main/accounts/startup.test.ts src/main/accounts/accountService.test.ts`
Expected: PASS

手动看一遍：全新安装要先填名称；已有库升级后锁定页显示「默认账号」；新建第二个账号后列表只有空库；标题栏点击后回到锁定页；设置里不能删除最后一个账号。

- [x] **Step 5: Commit**

```bash
git add src/components/lockScreenMode.ts src/components/lockScreenMode.test.ts src/components/LockScreen.vue src/components/SettingsView.vue src/components/TitleBar.vue src/App.vue src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts docs/code-map/database-schema.md
git commit -m "feat: 在锁定页和设置中切换本地账号"
```
