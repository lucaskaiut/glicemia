import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** API de produção — pode ser sobrescrita em glicemia-leitor.json ou pela variável GLICEMIA_API_URL. */
export const DEFAULT_API_URL = 'https://glicosimetro-api.noxtecnologias.com.br/api'

export interface Config {
  apiUrl: string
  /** Código de vinculação (token de API com permissão só de importar medições). */
  token: string | null
  /** Intervalo (s) para verificar se o aparelho foi conectado. */
  pollSeconds: number
  /** Mostra notificação do Windows ao sincronizar. */
  notify: boolean
  deviceName: string
}

export const isPackaged = Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg)

/** Configuração e logs: %APPDATA%\Glicemia (empacotado) ou a pasta atual (desenvolvimento). */
export const dataDir = isPackaged
  ? path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'Glicemia')
  : process.cwd()

export const configPath = path.join(dataDir, 'glicemia-leitor.json')

export function loadConfig(): Config {
  fs.mkdirSync(dataDir, { recursive: true })
  const raw = (fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}) as Partial<Config>

  const apiUrl = (process.env.GLICEMIA_API_URL || raw.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '')
  if (!/^https?:\/\//.test(apiUrl)) throw new Error(`"apiUrl" inválida em ${configPath}`)

  const token = typeof raw.token === 'string' && raw.token.startsWith('api_') ? raw.token.trim() : null

  return {
    apiUrl,
    token,
    pollSeconds: Math.max(1, Number(raw.pollSeconds ?? 3)),
    notify: raw.notify ?? true,
    deviceName: raw.deviceName ?? 'OK Meter Match II',
  }
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(dataDir, { recursive: true })
  const { apiUrl, token, pollSeconds, notify, deviceName } = config
  const out: Record<string, unknown> = { token, pollSeconds, notify, deviceName }
  if (apiUrl !== DEFAULT_API_URL) out.apiUrl = apiUrl
  fs.writeFileSync(configPath, JSON.stringify(out, null, 2) + '\n')
}
