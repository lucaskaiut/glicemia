import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Produção — sobrescrevíveis em glicemia-leitor.json ou por GLICEMIA_API_URL / GLICEMIA_PANEL_URL. */
export const DEFAULT_API_URL = 'https://glicosimetro-api.noxtecnologias.com.br/api'
export const DEFAULT_PANEL_URL = 'https://glicosimetro.noxtecnologias.com.br'

export interface LastSync {
  at: string
  created: number
  duplicates: number
  total: number
}

export interface Config {
  apiUrl: string
  panelUrl: string
  /** Token de API com permissão só de importar medições (obtido pela conexão OAuth). */
  token: string | null
  account: string | null
  notify: boolean
  deviceName: string
  lastSync: LastSync | null
}

/** %APPDATA%\Glicemia no Windows (mesma pasta da versão anterior, para migrar a conexão). */
export const dataDir =
  process.platform === 'win32'
    ? path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'Glicemia')
    : path.join(os.homedir(), '.config', 'glicemia')

export const configPath = path.join(dataDir, 'glicemia-leitor.json')

function readRaw(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function loadConfig(): Config {
  fs.mkdirSync(dataDir, { recursive: true })
  const raw = readRaw()
  const url = (v: unknown, fallback: string) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v : fallback).replace(/\/+$/, '')

  return {
    apiUrl: url(process.env.GLICEMIA_API_URL || raw.apiUrl, DEFAULT_API_URL),
    panelUrl: url(process.env.GLICEMIA_PANEL_URL || raw.panelUrl, DEFAULT_PANEL_URL),
    token: typeof raw.token === 'string' && raw.token.startsWith('api_') ? raw.token.trim() : null,
    account: typeof raw.account === 'string' ? raw.account : null,
    notify: raw.notify !== false,
    deviceName: typeof raw.deviceName === 'string' ? raw.deviceName : 'OK Meter Match II',
    lastSync: (raw.lastSync as LastSync | undefined) ?? null,
  }
}

/** Salva só o que mudou; URLs só quando diferentes do padrão (evita "prender" um ambiente de teste). */
export function saveConfig(patch: Partial<Config>): Config {
  fs.mkdirSync(dataDir, { recursive: true })
  const next = { ...readRaw(), ...patch } as Record<string, unknown>
  if (next.apiUrl === DEFAULT_API_URL || process.env.GLICEMIA_API_URL) delete next.apiUrl
  if (next.panelUrl === DEFAULT_PANEL_URL || process.env.GLICEMIA_PANEL_URL) delete next.panelUrl
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
  return loadConfig()
}
