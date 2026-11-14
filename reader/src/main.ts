import net from 'node:net'
import readline from 'node:readline/promises'
import { ApiError, clearPending, loadPending, savePending, sendImport, whoami, type ImportPayload } from './api'
import { configPath, loadConfig, saveConfig, type Config } from './config'
import { install, isInstalled, uninstall } from './install'
import { log } from './log'
import { notify } from './notify'
import { findMeter, parseMemory, readMeterMemory, type MeterInfo } from './okmeter'

const LOCK_PORT = 47_811
const RETRY_PENDING_MS = 60_000
const PANEL_HINT = 'No painel do Glicemia, abra "Aparelhos" e clique em "Gerar código do leitor".'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)

async function syncMeter(config: Config, meter: MeterInfo): Promise<void> {
  log('Glicosímetro conectado — lendo a memória...')
  const raw = await readMeterMemory(meter.path, log)
  const readings = parseMemory(raw)
  log(`${readings.length} medições na memória do aparelho.`)

  const payload: ImportPayload = {
    device: { model: 'okmeter-match-ii', identifier: meter.serialNumber || 'default', name: config.deviceName },
    readings: readings.map(({ index: _index, ...r }) => r),
  }

  await deliver(config, payload)
}

async function deliver(config: Config, payload: ImportPayload): Promise<boolean> {
  try {
    const result = await sendImport(config, payload)
    clearPending()
    log(`Enviado: ${result.created} novas, ${result.duplicates} já existiam.`)
    if (config.notify) {
      notify(
        'Glicemia',
        result.created > 0
          ? `${result.created} ${result.created === 1 ? 'medição nova enviada' : 'medições novas enviadas'}.`
          : 'Tudo em dia — nenhuma medição nova.',
      )
    }
    return true
  } catch (error) {
    const unlinked = error instanceof ApiError && (error.status === 401 || error.status === 403)
    const retryable = error instanceof ApiError ? error.retryable : true
    log(`Falha no envio: ${(error as Error).message}${retryable ? ' — vou tentar de novo.' : ''}`)
    if (retryable || unlinked) savePending(payload)
    if (config.notify) {
      notify(
        unlinked ? 'Glicemia — leitor desvinculado' : 'Glicemia — falha no envio',
        unlinked ? `Abra o glicemia-leitor.exe para vincular de novo. ${PANEL_HINT}` : (error as Error).message,
      )
    }
    return false
  }
}

async function watch(initial: Config, once: boolean): Promise<void> {
  let config = initial
  log(`Leitor iniciado. API: ${config.apiUrl}. Conecte o glicosímetro no cabo USB (a tela deve mostrar "USb").`)

  let connectedPath: string | null = null
  let lastPendingTry = 0
  let lastError: string | null = null

  for (;;) {
    try {
      config = loadConfig() // pega um código novo se o leitor for vinculado de novo
      const meter = await findMeter()

      if (meter && meter.path !== connectedPath) {
        connectedPath = meter.path
        await sleep(4000) // o aparelho leva alguns segundos para aceitar comandos após conectar
        await syncMeter(config, meter)
        if (once) return
      } else if (!meter && connectedPath) {
        log('Glicosímetro desconectado.')
        connectedPath = null
      }

      if (Date.now() - lastPendingTry > RETRY_PENDING_MS) {
        lastPendingTry = Date.now()
        const pending = loadPending()
        if (pending) {
          log('Reenviando medições pendentes...')
          await deliver(config, pending)
        }
      }
    } catch (error) {
      const message = (error as Error).message
      if (once) throw error
      // Só avisa (e loga) uma vez por erro repetido — ex.: falha do USB a cada verificação.
      if (message !== lastError) {
        log(`Erro: ${message}`)
        if (connectedPath) notify('Glicemia — não consegui ler o aparelho', message)
      }
      lastError = message
      // Não insistimos em loop: a próxima leitura acontece quando o aparelho for reconectado.
      await sleep(config.pollSeconds * 1000)
      continue
    }
    lastError = null

    await sleep(config.pollSeconds * 1000)
  }
}

/** Pede o código gerado no painel, confere a conta e salva. */
async function link(config: Config): Promise<Config> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log('\n=== Vincular o leitor à sua conta do Glicemia ===')
    console.log(PANEL_HINT)
    console.log('Copie o código (começa com "api_") e cole aqui (clique com o botão direito para colar).\n')

    for (;;) {
      const token = (await rl.question('Código do leitor: ')).trim()
      if (!token) continue
      if (!token.startsWith('api_')) {
        console.log('Esse não parece um código do leitor — ele começa com "api_". Tente de novo.\n')
        continue
      }
      try {
        const { account } = await whoami(config.apiUrl, token)
        const linked = { ...config, token }
        saveConfig(linked)
        clearPending()
        console.log(`\n✔ Vinculado à conta de ${account}.`)
        log(`Leitor vinculado à conta de ${account}.`)
        return linked
      } catch (error) {
        console.log(`\n✖ ${(error as Error).message}\n`)
        if (error instanceof ApiError && error.retryable) {
          console.log('Confira sua conexão com a internet e tente de novo.\n')
        }
      }
    }
  } finally {
    rl.close()
  }
}

async function askYesNo(question: string, fallback = true): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(`${question} ${fallback ? '(S/n)' : '(s/N)'} `)).trim().toLowerCase()
    return answer === '' ? fallback : answer.startsWith('s') || answer.startsWith('y')
  } finally {
    rl.close()
  }
}

async function waitEnter(message = 'Pressione Enter para fechar esta janela.'): Promise<void> {
  if (!interactive) return
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await rl.question(`\n${message}`)
  rl.close()
}

function acquireLock(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(LOCK_PORT, '127.0.0.1', () => resolve(true))
    server.unref()
  })
}

const HELP = `glicemia-leitor — envia as medições do OK Meter Match II para o Glicemia

  (sem argumentos)  na 1ª vez, vincula à sua conta e instala; depois fica
                    rodando e sincroniza sempre que o aparelho é conectado
  --vincular        troca o código (outra conta ou código novo)
  --uma-vez         lê o aparelho uma vez, envia e sai
  --instalar        inicia junto com o Windows, em segundo plano
  --desinstalar     remove da inicialização do Windows

Configuração: ${configPath}`

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--ajuda') || args.includes('-h')) return console.log(HELP)
  if (args.includes('--desinstalar')) {
    log(uninstall() ? 'Removido da inicialização do Windows.' : 'O leitor não estava na inicialização.')
    return
  }

  let config = loadConfig()

  // Vinculação: na primeira vez, ou quando pedido.
  if (!config.token || args.includes('--vincular')) {
    if (!interactive) {
      log(`Leitor sem vínculo com uma conta. Abra o glicemia-leitor.exe para vincular. ${PANEL_HINT}`)
      notify('Glicemia — vincule o leitor', `Abra o glicemia-leitor.exe para vincular à sua conta. ${PANEL_HINT}`)
      return
    }
    config = await link(config)

    if (!isInstalled() && (await askYesNo('\nIniciar o leitor junto com o Windows, em segundo plano?'))) {
      const exe = install()
      console.log(`\n✔ Pronto! O leitor está rodando em segundo plano (${exe}).`)
      console.log('Agora é só conectar o glicosímetro no cabo USB sempre que quiser enviar as medições.')
      console.log('Você já pode apagar o arquivo baixado.')
      return waitEnter()
    }
    if (isInstalled()) {
      console.log('\nO leitor em segundo plano passa a usar o novo código na próxima conexão do aparelho.')
      return waitEnter()
    }
  }

  if (args.includes('--instalar')) {
    log(`Instalado para iniciar com o Windows (${install()}). O leitor já está rodando em segundo plano.`)
    return waitEnter()
  }

  if (!(await acquireLock())) {
    log('O leitor já está rodando (em segundo plano ou em outra janela).')
    return waitEnter()
  }

  await watch(config, args.includes('--uma-vez'))
}

main().catch(async (error) => {
  log(`Erro fatal: ${(error as Error).message}`)
  notify('Glicemia — leitor parou', (error as Error).message)
  process.exitCode = 1
  await waitEnter()
})
