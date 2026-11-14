import crypto from 'node:crypto'
import http from 'node:http'
import os from 'node:os'
import { exchangeCode } from '../core/api'
import { loadConfig } from '../core/config'

const TIMEOUT_MS = 10 * 60_000
const b64url = (buf: Buffer) => buf.toString('base64url')

export class ConnectCancelled extends Error {}

function page(title: string, text: string, ok: boolean): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glicemia</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3efe6;color:#1d2330;font:15px/1.5 "Segoe UI",system-ui,sans-serif}
main{max-width:26rem;padding:2.5rem;background:#fbf9f4;border:1px solid #d9d1c1;border-radius:6px;text-align:center}
h1{font:500 1.5rem Georgia,serif;margin:.75rem 0 .5rem}p{color:#5c6270;margin:0}
.dot{display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:50%;background:${ok ? '#e2eee6' : '#f6e3df'};color:${ok ? '#2f6b4f' : '#b42318'};font-size:1.5rem}
</style></head><body><main><span class="dot">${ok ? '✓' : '!'}</span><h1>${title}</h1><p>${text}</p></main></body></html>`
}

/**
 * Conecta o app à conta (OAuth para apps nativos, RFC 8252 + PKCE):
 * abre o painel no navegador e recebe o código de volta num endereço local (127.0.0.1).
 */
export function connectAccount(openBrowser: (url: string) => void, signal: AbortSignal): Promise<{ token: string; account: string }> {
  const config = loadConfig()
  const verifier = b64url(crypto.randomBytes(48))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))

  return new Promise((resolve, reject) => {
    let redirectUri = ''
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const send = (status: number, title: string, text: string, ok: boolean) => {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(page(title, text, ok))
      }

      if (url.searchParams.get('state') !== state) {
        send(400, 'Link inválido', 'Volte ao aplicativo Glicemia e tente conectar de novo.', false)
        return
      }
      if (url.searchParams.get('error')) {
        send(200, 'Conexão cancelada', 'Você pode fechar esta aba.', false)
        finish(() => reject(new ConnectCancelled('Conexão cancelada.')))
        return
      }

      try {
        const result = await exchangeCode(config.apiUrl, { code: url.searchParams.get('code') ?? '', code_verifier: verifier, redirect_uri: redirectUri })
        send(200, 'Pronto!', `O aplicativo foi conectado à conta de ${result.account.replace(/[<>&]/g, '')}. Pode fechar esta aba e voltar ao Glicemia.`, true)
        finish(() => resolve(result))
      } catch (error) {
        send(400, 'Não deu certo', 'Volte ao aplicativo Glicemia e tente conectar de novo.', false)
        finish(() => reject(error))
      }
    })

    const timer = setTimeout(() => finish(() => reject(new ConnectCancelled('Tempo esgotado. Tente conectar de novo.'))), TIMEOUT_MS)
    const onAbort = () => finish(() => reject(new ConnectCancelled('Conexão cancelada.')))
    signal.addEventListener('abort', onAbort, { once: true })

    let done = false
    function finish(fn: () => void) {
      if (done) return
      done = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      setTimeout(() => server.close(), 500)
      fn()
    }

    server.on('error', (error) => finish(() => reject(error)))
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      redirectUri = `http://127.0.0.1:${port}/callback`
      const authorize = new URL('/conectar-app', config.panelUrl)
      authorize.search = new URLSearchParams({
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        device_name: os.hostname().slice(0, 60),
      }).toString()
      openBrowser(authorize.toString())
    })
  })
}
