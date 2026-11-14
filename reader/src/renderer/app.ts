// Interface do app (renderer). Fala com o processo principal só via window.glicemia (preload).
type Phase = 'unlinked' | 'waiting' | 'reading' | 'sending' | 'done' | 'error'

interface State {
  phase: Phase
  account: string | null
  message: string | null
  lastSync: { at: string; created: number; duplicates: number; total: number } | null
  pending: boolean
  connecting: boolean
  autoStart: boolean
  version: string
  panelUrl: string
}

interface Bridge {
  getState(): Promise<State>
  connect(): Promise<{ ok: boolean; cancelled?: boolean; message?: string }>
  cancelConnect(): Promise<void>
  disconnect(): Promise<void>
  setAutoStart(enabled: boolean): Promise<void>
  openPanel(): Promise<void>
  onState(cb: (s: State) => void): () => void
}

const api = (window as unknown as { glicemia: Bridge }).glicemia
const app = document.getElementById('app') as HTMLElement
const footer = document.getElementById('footer') as HTMLElement
let connectError: string | null = null
let confirmingDisconnect = false
let state: State

const ICONS = {
  usb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v14"/><path d="M8 6l4-4 4 4"/><circle cx="12" cy="19" r="3"/><path d="M12 10l-5 3v2"/><path d="M12 8l5 3v2"/></svg>',
  spin: '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 16.5h.01"/><circle cx="12" cy="12" r="9.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function when(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `hoje às ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `ontem às ${time}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')} às ${time}`
}

function unlinkedView(): string {
  if (state.connecting) {
    return `
      <div class="hero">
        <span class="badge">${ICONS.spin}</span>
        <h1>Continue no navegador</h1>
        <p>Abrimos o Glicemia no seu navegador. Entre na sua conta (com Google ou e-mail) e clique em <strong>Permitir</strong>.</p>
      </div>
      <button class="btn btn-secondary btn-block" data-action="cancel">Cancelar</button>`
  }
  return `
    <div class="hero">
      <span class="badge">${ICONS.link}</span>
      <h1>Conecte o Glicemia à sua conta</h1>
      <p>Depois disso, é só ligar o glicosímetro no cabo USB: as medições vão sozinhas para o seu painel.</p>
    </div>
    ${state.message ? `<p class="note">${esc(state.message)}</p>` : ''}
    ${connectError ? `<p class="note">${esc(connectError)}</p>` : ''}
    <button class="btn btn-primary btn-block" data-action="connect">Conectar à minha conta</button>
    <ol class="steps">
      <li><b>1</b><span>O navegador abre o Glicemia — entre ou crie sua conta grátis.</span></li>
      <li><b>2</b><span>Clique em <strong>Permitir</strong>. O app só consegue <strong>enviar</strong> medições.</span></li>
    </ol>`
}

function statusCard(): string {
  const s = state
  const views: Record<Exclude<Phase, 'unlinked'>, [string, string, string, string]> = {
    waiting: ['', ICONS.usb, 'Conecte o glicosímetro', 'Com o aparelho <strong>desligado</strong>, ligue o cabo USB no computador. A tela dele vai mostrar <strong>USb</strong>.'],
    reading: ['', ICONS.spin, 'Lendo o glicosímetro…', 'Leva uns 20 segundos. Não desconecte o cabo.'],
    sending: ['', ICONS.spin, 'Enviando medições…', 'Quase lá.'],
    done: ['ok', ICONS.check, 'Tudo certo!', s.lastSync && s.lastSync.created > 0
      ? `<strong>${s.lastSync.created}</strong> ${s.lastSync.created === 1 ? 'medição nova enviada' : 'medições novas enviadas'}. Já pode desconectar o cabo.`
      : 'Nenhuma medição nova — está tudo em dia. Já pode desconectar o cabo.'],
    error: ['err', ICONS.alert, 'Não deu certo', esc(s.message ?? 'Desconecte e conecte o cabo de novo.')],
  }
  const [tone, icon, title, text] = views[s.phase as Exclude<Phase, 'unlinked'>]
  const meta = s.lastSync
    ? `Última sincronização: ${when(s.lastSync.at)} · ${s.lastSync.total} medições no aparelho`
    : 'Ainda não sincronizou neste computador.'
  return `
    <section class="card">
      <div class="status">
        <span class="badge ${tone}">${icon}</span>
        <div><h2>${title}</h2><p>${text}</p></div>
      </div>
      <p class="meta">${meta}${s.pending ? ' · há medições aguardando envio' : ''}</p>
    </section>`
}

function linkedView(): string {
  return `
    <div class="account">
      <span>Conectado à conta de <strong>${esc(state.account ?? '…')}</strong></span>
      ${confirmingDisconnect
        ? '<span><button class="link" data-action="disconnect-yes">Desconectar</button> · <button class="link" data-action="disconnect-no">Manter</button></span>'
        : '<button class="link" data-action="disconnect">Desconectar</button>'}
    </div>
    ${statusCard()}
    <label class="row card toggle">
      <span><strong>Iniciar com o Windows</strong><br /><span class="hint">Fica perto do relógio, pronto para quando você conectar o aparelho.</span></span>
      <span class="switch"><input type="checkbox" data-action="autostart" ${state.autoStart ? 'checked' : ''} aria-label="Iniciar com o Windows" /><span></span></span>
    </label>
    <button class="btn btn-secondary btn-block" data-action="panel">Abrir meu painel</button>`
}

function render(): void {
  app.innerHTML = state.phase === 'unlinked' ? unlinkedView() : linkedView()
  footer.innerHTML = `<span>Glicemia ${esc(state.version)}</span><span>Fechar a janela mantém o app rodando</span>`
}

app.addEventListener('click', async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
  if (!target) return
  switch (target.dataset.action) {
    case 'connect': {
      connectError = null
      const result = await api.connect()
      if (!result.ok && !result.cancelled) connectError = `Não foi possível conectar: ${result.message}`
      render()
      break
    }
    case 'cancel':
      await api.cancelConnect()
      break
    case 'disconnect':
      confirmingDisconnect = true
      render()
      break
    case 'disconnect-no':
      confirmingDisconnect = false
      render()
      break
    case 'disconnect-yes':
      confirmingDisconnect = false
      await api.disconnect()
      break
    case 'panel':
      await api.openPanel()
      break
  }
})

app.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement
  if (input.dataset.action === 'autostart') void api.setAutoStart(input.checked)
})

api.onState((next) => {
  state = next
  render()
})

void api.getState().then((initial) => {
  state = initial
  render()
})
