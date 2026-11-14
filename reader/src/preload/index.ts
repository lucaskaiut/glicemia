import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

/** Única ponte entre a janela e o app (contextIsolation + sandbox). */
contextBridge.exposeInMainWorld('glicemia', {
  getState: () => ipcRenderer.invoke('state:get'),
  connect: () => ipcRenderer.invoke('account:connect'),
  cancelConnect: () => ipcRenderer.invoke('account:cancel'),
  disconnect: () => ipcRenderer.invoke('account:disconnect'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('autostart:set', enabled),
  openPanel: () => ipcRenderer.invoke('panel:open'),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_e: IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
})
