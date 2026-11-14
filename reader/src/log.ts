import fs from 'node:fs'
import path from 'node:path'
import { dataDir } from './config'

const file = path.join(dataDir, 'glicemia-leitor.log')
const MAX_BYTES = 1024 * 1024

export function log(message: string): void {
  const line = `[${new Date().toLocaleString('pt-BR')}] ${message}`
  console.log(line)
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file + '.1')
    fs.appendFileSync(file, line + '\n')
  } catch {
    // log em arquivo é melhor esforço
  }
}
