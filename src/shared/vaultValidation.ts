import type { ErrorCodeKey } from './errors'
import { ErrorCode } from './errors'

export function validateMasterPasswordSetup(
  password: string,
  confirmPassword: string,
): ErrorCodeKey | null {
  if (password.length < 4) {
    return ErrorCode.MASTER_PASSWORD_TOO_SHORT
  }
  if (password !== confirmPassword) {
    return ErrorCode.MASTER_PASSWORD_MISMATCH
  }
  return null
}
