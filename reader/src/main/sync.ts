import { EventEmitter } from 'node:events'
import { ApiError, clearPending, loadPending, savePending, sendImport, whoami, type ImportPayload } from '../core/api'
import { loadConfig, saveConfig, type Config, type LastSync } from '../core/config'
import { log } from '../core/log'
import { findMeter, parseMemory, readMeterMemory } from '../core/okmeter'

export type Phase = 'unlinked' | 'waiting' | 'reading' | 'sending' | 'done' | 'error'

export interface SyncState {
  phase: Phase
  account: string | null
  message: string | null
  lastSync: LastSync | null
  pending: boolean
}

export interface SyncEvents {
  state: [SyncState]
  synced: [LastSync]
  failed: [string]
  unlinked: []
}

const POLL_MS = 3000
const RETRY_PENDING_MS = 60_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Vigia o USB e sincroniza o glicosímetro a cada conexão. Emite o estado para a janela.
 */
export class ReaderSync extends EventEmitter<SyncEvents> {
  private running = false
  private connectedPath: string | null = null
  private lastPendingTry = 0
  private lastError: string | null = null
  private current: SyncState

  constructor() {
    super()
    const config = loadConfig()
    this.current = {
      phase: config.token ? 'waiting' : 'unlinked',
      account: config.account,
      message: null,
      lastSync: config.lastSync,
      pending: loadPending() !== null,
    }
  }

  get state(): SyncState {
    return this.current
  }

  private set(patch: Partial<SyncState>): void {
    this.current = { ...this.current, ...patch }
    this.emit('state', this.current)
  }

  /** Recarrega a configuração (ex.: depois de conectar/desconectar a conta). */
  refresh(): void {
    const config = loadConfig()
    this.set({
      phase: config.token ? 'waiting' : 'unlinked',
      account: config.account,
      lastSync: config.lastSync,
      message: null,
    })
    this.connectedPath = null // força ler o aparelho se ele já estiver conectado
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    await this.fillAccountName()

    while (this.running) {
      const config = loadConfig()
      if (config.token) await this.tick(config)
      await sleep(POLL_MS)
    }
  }

  stop(): void {
    this.running = false
  }

  /** Conexões da versão anterior (código colado) não guardavam o nome da conta. */
  private async fillAccountName(): Promise<void> {
    const config = loadConfig()
    if (!config.token || config.account) return
    try {
      const { account } = await whoami(config.apiUrl, config.token)
      saveConfig({ account })
      this.set({ account })
    } catch {
      // sem rede agora: tenta de novo na próxima abertura
    }
  }

  private async tick(config: Config): Promise<void> {
    try {
      const meter = await findMeter()

      if (meter && meter.path !== this.connectedPath) {
        this.connectedPath = meter.path
        this.set({ phase: 'reading', message: 'Lendo o glicosímetro…' })
        log('Glicosímetro conectado — lendo a memória...')
        await sleep(4000) // o aparelho leva alguns segundos para aceitar comandos após conectar

        const readings = parseMemory(await readMeterMemory(meter.path, log))
        log(`${readings.length} medições na memória do aparelho.`)

        await this.deliver(config, {
          device: { model: 'okmeter-match-ii', identifier: meter.serialNumber || 'default', name: config.deviceName },
          readings: readings.map(({ index: _index, ...r }) => r),
        })
      } else if (!meter && this.connectedPath) {
        log('Glicosímetro desconectado.')
        this.connectedPath = null
        if (this.current.phase !== 'error') this.set({ phase: 'waiting', message: null })
      }

      if (Date.now() - this.lastPendingTry > RETRY_PENDING_MS) {
        this.lastPendingTry = Date.now()
        const pending = loadPending()
        if (pending) await this.deliver(config, pending)
      }
      this.lastError = null
    } catch (error) {
      const message = (error as Error).message
      if (message !== this.lastError) {
        log(`Erro: ${message}`)
        if (this.connectedPath) {
          this.set({ phase: 'error', message })
          this.emit('failed', message)
        }
      }
      this.lastError = message
    }
  }

  private async deliver(config: Config, payload: ImportPayload): Promise<void> {
    this.set({ phase: 'sending', message: `Enviando ${payload.readings.length} medições…` })
    try {
      const result = await sendImport(config, payload)
      clearPending()
      const lastSync: LastSync = { at: new Date().toISOString(), created: result.created, duplicates: result.duplicates, total: result.received }
      saveConfig({ lastSync })
      log(`Enviado: ${result.created} novas, ${result.duplicates} já existiam.`)
      this.set({ phase: 'done', message: null, lastSync, pending: false })
      this.emit('synced', lastSync)
    } catch (error) {
      const unlinked = error instanceof ApiError && (error.status === 401 || error.status === 403)
      const retryable = error instanceof ApiError ? error.retryable : true
      log(`Falha no envio: ${(error as Error).message}`)
      if (retryable || unlinked) savePending(payload)

      if (unlinked) {
        saveConfig({ token: null })
        this.set({ phase: 'unlinked', message: 'A conexão com a sua conta foi removida. Conecte de novo — as medições lidas serão enviadas em seguida.', pending: true })
        this.emit('unlinked')
        return
      }
      this.set({ phase: 'error', message: retryable ? 'Sem conexão com o Glicemia. As medições ficaram guardadas e serão enviadas automaticamente.' : (error as Error).message, pending: retryable })
      this.emit('failed', (error as Error).message)
    }
  }
}
