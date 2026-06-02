import fs from 'fs'
import path from 'path'
import { shell } from 'electron'
import { appError, ErrorCode } from '../../shared/errors'
import { isUnlocked } from './sessionService'

export async function openLocalProgram(programPath: string): Promise<void> {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)

  const trimmed = programPath.trim()
  if (!trimmed) throw appError(ErrorCode.LOCAL_PROGRAM_PATH_EMPTY)

  const resolved = path.resolve(trimmed)
  if (!fs.existsSync(resolved)) {
    throw appError(ErrorCode.LOCAL_PROGRAM_NOT_FOUND)
  }

  const errorMessage = await shell.openPath(resolved)
  if (errorMessage) {
    throw appError(ErrorCode.LOCAL_PROGRAM_OPEN_FAILED)
  }
}
