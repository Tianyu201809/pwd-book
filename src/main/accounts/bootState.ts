import type { MachineDocument } from '../../shared/machineDocument'
import type { BootState } from '../../shared/types'
import type { BootResult } from './startup'

function copyState(state: BootState): BootState {
  return {
    ...state,
    accounts: state.accounts.map((account) => ({ id: account.id, name: account.name })),
  }
}

const emptyBootState: BootState = {
  blocked: null,
  warning: null,
  accounts: [],
  activeAccountId: null,
  activeAccountName: null,
  vaultFile: 'missing',
  quarantinedPath: null,
}

let currentBootState: BootState = copyState(emptyBootState)

export function getBootState(): BootState {
  return copyState(currentBootState)
}

export function setBootState(next: BootState): void {
  currentBootState = copyState(next)
}

export function bootStateFromDocument(
  document: MachineDocument,
  vaultFile: BootState['vaultFile'],
  warning: BootState['warning'],
  quarantinedPath: string | null,
): BootState {
  const active = document.accounts.find((account) => account.id === document.activeAccountId)
  return {
    blocked: null,
    warning,
    accounts: document.accounts.map((account) => ({ id: account.id, name: account.name })),
    activeAccountId: document.activeAccountId,
    activeAccountName: active?.name ?? null,
    vaultFile,
    quarantinedPath,
  }
}

export function bootStateFromResult(result: BootResult): BootState {
  if (result.kind === 'blocked') {
    return { ...emptyBootState, accounts: [], blocked: result.reason }
  }
  if (result.kind === 'ready') {
    return bootStateFromDocument(result.document, 'ready', result.warning, null)
  }
  return copyState(emptyBootState)
}
