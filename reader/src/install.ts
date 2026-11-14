import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { isPackaged } from './config'

/**
 * Inicialização automática: o .exe é copiado para %LOCALAPPDATA%\Programs\Glicemia
 * (assim o arquivo baixado pode ser apagado) e um .vbs na pasta Inicializar do
 * usuário o abre com a janela oculta. Não exige administrador.
 */
const startupDir = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
const launcher = path.join(startupDir, 'glicemia-leitor.vbs')
const programDir = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Glicemia')
export const installedExe = path.join(programDir, 'glicemia-leitor.exe')

export function isInstalled(): boolean {
  return fs.existsSync(launcher)
}

export function install(): string {
  let exe = process.execPath
  if (isPackaged && path.resolve(exe).toLowerCase() !== path.resolve(installedExe).toLowerCase()) {
    fs.mkdirSync(programDir, { recursive: true })
    try {
      fs.copyFileSync(exe, installedExe)
    } catch {
      // Uma versão anterior pode estar rodando e travando o arquivo: encerramos e tentamos de novo.
      spawn('taskkill', ['/IM', 'glicemia-leitor.exe', '/F', '/FI', `PID ne ${process.pid}`], { stdio: 'ignore', windowsHide: true })
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500)
      fs.copyFileSync(exe, installedExe)
    }
    exe = installedExe
  }

  fs.mkdirSync(startupDir, { recursive: true })
  fs.writeFileSync(
    launcher,
    `Set sh = CreateObject("WScript.Shell")\r\nsh.CurrentDirectory = "${path.dirname(exe)}"\r\nsh.Run """${exe}""", 0, False\r\n`,
  )
  spawn('wscript.exe', [launcher], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  return exe
}

export function uninstall(): boolean {
  if (!fs.existsSync(launcher)) return false
  fs.rmSync(launcher)
  return true
}
