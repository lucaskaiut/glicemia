import fs from 'node:fs'
import path from 'node:path'
import { dataDir, type Config } from './config'
import type { MeterReading } from './okmeter'

export interface ImportPayload {
  device: { model: string; identifier: string; name: string }
  readings: Array<Omit<MeterReading, 'index'>>
}

export interface ImportResult {
  received: number
  created: number
  duplicates: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status = 0,
  ) {
    super(message)
  }
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'glicemia-app/2.0',
})

/** Troca o código de autorização (OAuth + PKCE) por um token que só importa medições. */
export async function exchangeCode(apiUrl: string, body: { code: string; code_verifier: string; redirect_uri: string }): Promise<{ token: string; account: string }> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}/reader/token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'glicemia-app/2.0' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    throw new ApiError(`Sem conexão com o Glicemia (${(error as Error).message})`, true)
  }
  const json = (await response.json().catch(() => null)) as { message?: string; data?: { token: string; account: string } } | null
  if (response.ok && json?.data) return json.data
  throw new ApiError(json?.message ?? `HTTP ${response.status}`, response.status >= 500, response.status)
}

/** Confere o código de vinculação e devolve o nome da conta. */
export async function whoami(apiUrl: string, token: string): Promise<{ account: string }> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}/glucose/reader/whoami`, { headers: headers(token), signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    throw new ApiError(`Sem conexão com ${apiUrl} (${(error as Error).message})`, true)
  }
  const body = (await response.json().catch(() => null)) as { data?: { account: string } } | null
  if (response.ok && body?.data) return body.data
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Código inválido, revogado ou sem permissão de importar medições.', false, response.status)
  }
  throw new ApiError(`A API respondeu HTTP ${response.status}.`, response.status >= 500, response.status)
}

const pendingPath = path.join(dataDir, 'pending.json')

export async function sendImport(config: Config, payload: ImportPayload): Promise<ImportResult> {
  let response: Response
  try {
    response = await fetch(`${config.apiUrl}/glucose/import`, {
      method: 'POST',
      headers: headers(config.token ?? ''),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (error) {
    throw new ApiError(`Sem conexão com a API (${(error as Error).message})`, true)
  }

  const body = (await response.json().catch(() => null)) as { message?: string; data?: ImportResult } | null

  if (response.ok && body?.data) return body.data

  const message = body?.message ?? `HTTP ${response.status}`
  // 401/403/422 não se resolvem tentando de novo; 5xx/429 sim.
  throw new ApiError(`A API recusou o envio: ${message}`, response.status >= 500 || response.status === 429, response.status)
}

/** Guarda o último despejo não enviado. Como a API deduplica, só o mais recente importa. */
export function savePending(payload: ImportPayload): void {
  fs.writeFileSync(pendingPath, JSON.stringify(payload))
}

export function loadPending(): ImportPayload | null {
  try {
    return JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as ImportPayload
  } catch {
    return null
  }
}

export function clearPending(): void {
  fs.rmSync(pendingPath, { force: true })
}
