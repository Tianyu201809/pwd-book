import fs from 'fs'
import path from 'path'
import {
  parseMachineDocument,
  type MachineDocument,
  type MachineSettings,
} from '../../shared/machineDocument'

function machineFile(userData: string): string {
  return path.join(userData, 'machine.json')
}

export function readMachineDocument(userData: string): MachineDocument | null {
  try {
    const raw = fs.readFileSync(machineFile(userData), 'utf8')
    return parseMachineDocument(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeMachineDocument(userData: string, document: MachineDocument): void {
  const file = machineFile(userData)
  const temporary = path.join(userData, 'machine.json.tmp')
  fs.writeFileSync(temporary, JSON.stringify(document))
  fs.renameSync(temporary, file)
}

export function updateMachineSettings(
  userData: string,
  partial: Partial<MachineSettings>,
): MachineSettings {
  const document = readMachineDocument(userData)
  if (document === null) {
    throw new Error('MACHINE_REGISTRY_DAMAGED')
  }
  const settings: MachineSettings = { ...document.settings, ...partial }
  writeMachineDocument(userData, { ...document, settings })
  return settings
}
