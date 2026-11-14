import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { log } from '../core/log'

/**
 * Remove a versão anterior (leitor de terminal): o atalho oculto na pasta Inicializar
 * e o executável antigo. A conexão (token) é aproveitada — a pasta de configuração é a mesma.
 */
export function removeLegacyReader(): void {
  if (process.platform !== 'win32') return
  const startup = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'glicemia-leitor.vbs')
  const oldExe = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Glicemia', 'glicemia-leitor.exe')

  if (!fs.existsSync(startup) && !fs.existsSync(oldExe)) return

  execFile('taskkill', ['/IM', 'glicemia-leitor.exe', '/F'], { windowsHide: true }, () => {
    for (const file of [startup, oldExe]) {
      try {
        fs.rmSync(file, { force: true })
      } catch {
        // melhor esforço
      }
    }
    log('Versão anterior do leitor removida.')
  })
}
