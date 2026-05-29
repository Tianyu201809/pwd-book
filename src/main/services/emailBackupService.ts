import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { encryptSecret, decryptSecret, verifyMasterPassword } from '../crypto/vaultCrypto'
import { getSetting, setSetting } from '../db/helpers'
import { createPasswordProtectedBackupZip } from './backupCrypto'
import { buildExportPayload } from './exportPayloadService'
import { getSessionKey, isUnlocked } from './sessionService'
import type {
  BackupFrequency,
  BackupStatus,
  EmailBackupSettings,
  EmailBackupSettingsUpdate,
  LastBackupInfo,
  SmtpSettingsInput,
} from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'

const SETTINGS_KEY = 'email_backup_settings'

interface StoredEmailBackupSettings {
  recipientEmail: string
  frequency: BackupFrequency
  smtp: {
    host: string
    port: number
    secure: boolean
    username: string
    passwordEncrypted: string
  }
  lastBackup: LastBackupInfo
}

const MASTER_SALT_KEY = 'master_salt'
const MASTER_HASH_KEY = 'master_hash'

function defaultStoredSettings(): StoredEmailBackupSettings {
  return {
    recipientEmail: '',
    frequency: 'manual',
    smtp: {
      host: '',
      port: 465,
      secure: true,
      username: '',
      passwordEncrypted: '',
    },
    lastBackup: {
      at: null,
      entryCount: 0,
      sizeBytes: 0,
      status: 'never',
    },
  }
}

function readStoredSettings(): StoredEmailBackupSettings {
  const raw = getSetting(SETTINGS_KEY)
  if (!raw) return defaultStoredSettings()
  try {
    const parsed = JSON.parse(raw) as Partial<StoredEmailBackupSettings>
    const defaults = defaultStoredSettings()
    return {
      recipientEmail: parsed.recipientEmail ?? defaults.recipientEmail,
      frequency: parsed.frequency ?? defaults.frequency,
      smtp: {
        host: parsed.smtp?.host ?? defaults.smtp.host,
        port: parsed.smtp?.port ?? defaults.smtp.port,
        secure: parsed.smtp?.secure ?? defaults.smtp.secure,
        username: parsed.smtp?.username ?? defaults.smtp.username,
        passwordEncrypted: parsed.smtp?.passwordEncrypted ?? defaults.smtp.passwordEncrypted,
      },
      lastBackup: {
        at: parsed.lastBackup?.at ?? defaults.lastBackup.at,
        entryCount: parsed.lastBackup?.entryCount ?? defaults.lastBackup.entryCount,
        sizeBytes: parsed.lastBackup?.sizeBytes ?? defaults.lastBackup.sizeBytes,
        status: parsed.lastBackup?.status ?? defaults.lastBackup.status,
      },
    }
  } catch {
    return defaultStoredSettings()
  }
}

function writeStoredSettings(settings: StoredEmailBackupSettings): void {
  setSetting(SETTINGS_KEY, JSON.stringify(settings))
}

function decryptSmtpPassword(encrypted: string): string {
  if (!encrypted) return ''
  if (!isUnlocked()) return ''
  return decryptSecret(encrypted, getSessionKey())
}

function encryptSmtpPassword(plain: string): string {
  if (!plain) return ''
  if (!isUnlocked()) {
    throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  }
  return encryptSecret(plain, getSessionKey())
}

function toPublicSettings(stored: StoredEmailBackupSettings): EmailBackupSettings {
  return {
    recipientEmail: stored.recipientEmail,
    frequency: stored.frequency,
    smtp: {
      host: stored.smtp.host,
      port: stored.smtp.port,
      secure: stored.smtp.secure,
      username: stored.smtp.username,
      hasPassword: Boolean(stored.smtp.passwordEncrypted),
    },
    lastBackup: { ...stored.lastBackup },
  }
}

function validateRecipientEmail(email: string): void {
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw appError(ErrorCode.EMAIL_BACKUP_INVALID_RECIPIENT)
  }
}

function ensureSmtpConfigured(stored: StoredEmailBackupSettings): void {
  if (!stored.smtp.host.trim() || !stored.smtp.username.trim()) {
    throw appError(ErrorCode.EMAIL_BACKUP_NOT_CONFIGURED)
  }
  if (!stored.smtp.passwordEncrypted) {
    throw appError(ErrorCode.EMAIL_BACKUP_PASSWORD_REQUIRED)
  }
}

function createTransport(stored: StoredEmailBackupSettings): Transporter {
  ensureSmtpConfigured(stored)
  const password = decryptSmtpPassword(stored.smtp.passwordEncrypted)
  if (!password) {
    throw appError(ErrorCode.EMAIL_BACKUP_PASSWORD_REQUIRED)
  }

  return nodemailer.createTransport({
    host: stored.smtp.host.trim(),
    port: stored.smtp.port,
    secure: stored.smtp.secure,
    auth: {
      user: stored.smtp.username.trim(),
      pass: password,
    },
  })
}

function verifyMasterPasswordForBackup(masterPassword: string): void {
  const salt = getSetting(MASTER_SALT_KEY)
  const hash = getSetting(MASTER_HASH_KEY)
  if (!salt || !hash) {
    throw appError(ErrorCode.MASTER_PASSWORD_NOT_CREATED)
  }
  if (!verifyMasterPassword(masterPassword, salt, hash)) {
    throw appError(ErrorCode.WRONG_MASTER_PASSWORD)
  }
}

function updateLastBackup(
  stored: StoredEmailBackupSettings,
  patch: Partial<LastBackupInfo>,
): StoredEmailBackupSettings {
  const next = {
    ...stored,
    lastBackup: {
      ...stored.lastBackup,
      ...patch,
    },
  }
  writeStoredSettings(next)
  return next
}

export function getEmailBackupSettings(): EmailBackupSettings {
  return toPublicSettings(readStoredSettings())
}

export function updateEmailBackupSettings(partial: EmailBackupSettingsUpdate): EmailBackupSettings {
  if (!isUnlocked()) {
    throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  }

  const current = readStoredSettings()
  const next: StoredEmailBackupSettings = { ...current }

  if (partial.recipientEmail !== undefined) {
    next.recipientEmail = partial.recipientEmail.trim()
  }
  if (partial.frequency !== undefined) {
    next.frequency = partial.frequency
  }
  if (partial.smtp) {
    next.smtp = {
      ...next.smtp,
      host: partial.smtp.host.trim(),
      port: partial.smtp.port,
      secure: partial.smtp.secure,
      username: partial.smtp.username.trim(),
      passwordEncrypted: next.smtp.passwordEncrypted,
    }
    if (partial.smtp.password && partial.smtp.password.length > 0) {
      next.smtp.passwordEncrypted = encryptSmtpPassword(partial.smtp.password)
    }
  }

  writeStoredSettings(next)
  return toPublicSettings(next)
}

export async function testEmailConnection(): Promise<void> {
  if (!isUnlocked()) {
    throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  }

  const stored = readStoredSettings()
  ensureSmtpConfigured(stored)

  const transport = createTransport(stored)
  try {
    await transport.verify()
  } catch {
    throw appError(ErrorCode.EMAIL_BACKUP_SMTP_FAILED)
  }
}

export async function sendBackupNow(masterPassword: string): Promise<EmailBackupSettings> {
  if (!isUnlocked()) {
    throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  }

  const stored = readStoredSettings()
  validateRecipientEmail(stored.recipientEmail)
  ensureSmtpConfigured(stored)

  verifyMasterPasswordForBackup(masterPassword)
  const payload = buildExportPayload()
  const { buffer, sizeBytes } = await createPasswordProtectedBackupZip(payload, masterPassword)
  const filename = `pwdbook-backup-${Date.now()}.zip`

  const transport = createTransport(stored)
  try {
    await transport.sendMail({
      from: stored.smtp.username.trim(),
      to: stored.recipientEmail.trim(),
      subject: 'PwdBook Vault Backup',
      text:
        'Your PwdBook vault backup is attached as a password-protected ZIP (AES-256). ' +
        'Use your master password to extract the JSON (for import) and Excel (for viewing) files inside.',
      attachments: [
        {
          filename,
          content: buffer,
          contentType: 'application/zip',
        },
      ],
    })
  } catch {
    updateLastBackup(stored, {
      at: Date.now(),
      entryCount: payload.entries.length,
      sizeBytes,
      status: 'failed' as BackupStatus,
    })
    throw appError(ErrorCode.EMAIL_BACKUP_SEND_FAILED)
  }

  const updated = updateLastBackup(stored, {
    at: Date.now(),
    entryCount: payload.entries.length,
    sizeBytes,
    status: 'success',
  })
  return toPublicSettings(updated)
}

export function isScheduledBackupDue(): boolean {
  const stored = readStoredSettings()
  if (stored.frequency === 'manual') return false
  if (!stored.recipientEmail.trim() || !stored.smtp.host.trim() || !stored.smtp.passwordEncrypted) {
    return false
  }

  const lastAt = stored.lastBackup.at
  if (!lastAt) return true

  const elapsed = Date.now() - lastAt
  const intervalMs =
    stored.frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
  return elapsed >= intervalMs
}

export function getStoredFrequency(): BackupFrequency {
  return readStoredSettings().frequency
}
