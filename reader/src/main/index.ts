import path from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron'
import { clearPending } from '../core/api'
import { loadConfig, saveConfig } from '../core/config'
import { log } from '../core/log'
import { removeLegacyReader } from './legacy'
import { ConnectCancelled, connectAccount } from './oauth'
import { ReaderSync, type SyncState } from './sync'

const APP_ID = 'br.com.noxtecnologias.glicemia'
const startHidden = process.argv.includes('--hidden')
const assets = (file: string) => path.join(__dirname, '..', '..', 'assets', file)

let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let connecting: AbortController | null = null
const sync = new ReaderSync()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.whenReady().then(boot)
}

function boot(): void {
  app.setAppUserModelId(APP_ID)
  Menu.setApplicationMenu(null)
  removeLegacyReader()

  createTray()
  if (!startHidden) showWindow()

  sync.on('state', (state) => {
    win?.webContents.send('state', publicState(state))
    tray?.setToolTip(trayTooltip(state))
  })
  sync.on('synced', (s) => {
    if (!loadConfig().notify) return
    notify(
      'Glicemia',
      s.created > 0 ? `${s.created} ${s.created === 1 ? 'medição nova enviada' : 'medições novas enviadas'}.` : 'Tudo em dia — nenhuma medição nova.',
    )
  })
  sync.on('failed', (message) => notify('Glicemia — não deu certo', message))
  sync.on('unlinked', () => {
    notify('Glicemia — conecte de novo', 'A conexão com a sua conta foi removida.')
    showWindow()
  })

  void sync.start()
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body, icon: assets('icon.png') }).show()
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 440,
    height: 600,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Glicemia',
    icon: assets('icon.png'),
    backgroundColor: '#f3efe6',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  w.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  w.once('ready-to-show', () => w.show())
  // Fechar a janela só esconde: o app continua cuidando do glicosímetro, perto do relógio.
  w.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    w.hide()
  })
  // Links externos abrem no navegador.
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  w.webContents.on('will-navigate', (event) => event.preventDefault())
  return w
}

function showWindow(): void {
  if (!win || win.isDestroyed()) win = createWindow()
  else {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(assets('tray.png')))
  tray.setToolTip(trayTooltip(sync.state))
  tray.on('click', () => showWindow())
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Glicemia', click: () => showWindow() },
      { label: 'Abrir o painel no navegador', click: () => void shell.openExternal(loadConfig().panelUrl) },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          quitting = true
          sync.stop()
          app.quit()
        },
      },
    ]),
  )
}

function trayTooltip(state: SyncState): string {
  if (state.phase === 'unlinked') return 'Glicemia — conecte à sua conta'
  if (state.phase === 'reading' || state.phase === 'sending') return 'Glicemia — sincronizando…'
  return 'Glicemia — aguardando o glicosímetro'
}

function autoStartEnabled(): boolean {
  return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin
}

function setAutoStart(enabled: boolean): void {
  if (!app.isPackaged || process.env.GLICEMIA_NO_AUTOSTART) return
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

function publicState(state: SyncState) {
  return { ...state, connecting: connecting !== null, autoStart: autoStartEnabled(), version: app.getVersion(), panelUrl: loadConfig().panelUrl }
}

// --- IPC (a janela só conversa por aqui; ver preload) ---

ipcMain.handle('state:get', () => publicState(sync.state))

ipcMain.handle('account:connect', async () => {
  connecting?.abort()
  connecting = new AbortController()
  win?.webContents.send('state', publicState(sync.state))
  try {
    const openBrowser = (url: string) => {
      log(`Abrindo o navegador para conectar: ${url.split('?')[0]}`)
      if (process.env.GLICEMIA_NO_BROWSER) log(`URL de conexão: ${url}`)
      else void shell.openExternal(url)
    }
    const { token, account } = await connectAccount(openBrowser, connecting.signal)
    saveConfig({ token, account })
    log(`Conectado à conta de ${account}.`)
    if (!autoStartEnabled()) setAutoStart(true) // padrão: inicia com o Windows
    sync.refresh()
    showWindow()
    return { ok: true as const }
  } catch (error) {
    if (error instanceof ConnectCancelled) return { ok: false as const, cancelled: true, message: error.message }
    log(`Falha ao conectar: ${(error as Error).message}`)
    return { ok: false as const, cancelled: false, message: (error as Error).message }
  } finally {
    connecting = null
    win?.webContents.send('state', publicState(sync.state))
  }
})

ipcMain.handle('account:cancel', () => connecting?.abort())

ipcMain.handle('account:disconnect', () => {
  saveConfig({ token: null, account: null, lastSync: null })
  clearPending()
  log('Conta desconectada neste computador.')
  sync.refresh()
})

ipcMain.handle('autostart:set', (_event, enabled: boolean) => {
  setAutoStart(Boolean(enabled))
  win?.webContents.send('state', publicState(sync.state))
})

ipcMain.handle('panel:open', () => shell.openExternal(loadConfig().panelUrl))

app.on('before-quit', () => {
  quitting = true
})
app.on('window-all-closed', () => {
  // continua rodando na bandeja
})
