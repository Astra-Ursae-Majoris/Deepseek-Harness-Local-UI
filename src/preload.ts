/** Preload: minimal, whitelisted bridge between the page and the main process. */
import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface ServerStatusPayload {
  status: 'stopped' | 'starting' | 'running'
  url: string
  port: number
}

contextBridge.exposeInMainWorld('dshDesktop', {
  /** Current server status snapshot. */
  status: (): Promise<ServerStatusPayload> => ipcRenderer.invoke('server:status'),
  /** Start the DSH web server and wait for readiness. */
  startServer: (): Promise<{ ok: boolean; message?: string }> => ipcRenderer.invoke('server:start'),
  /** Stop the DSH web server. */
  stopServer: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('server:stop'),
  /** Pick a DSH install directory with a native folder dialog. */
  pickInstallDir: (): Promise<{ ok: boolean; dir?: string; message?: string }> =>
    ipcRenderer.invoke('server:pick-install-dir'),
  /** Configure the close behavior. */
  setCloseBehavior: (behavior: 'ask' | 'stop' | 'keep'): Promise<void> =>
    ipcRenderer.invoke('settings:set-close-behavior', behavior),
  getCloseBehavior: (): Promise<'ask' | 'stop' | 'keep'> => ipcRenderer.invoke('settings:get-close-behavior'),
  /** Real on-disk path of a dropped file (browsers cannot provide this). */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  /** Model-provider API key management. */
  models: {
    list: () => ipcRenderer.invoke('models:list'),
    setKey: (ref: string, value: string) => ipcRenderer.invoke('models:set-key', ref, value),
    unsetKey: (ref: string) => ipcRenderer.invoke('models:unset-key', ref),
  },
})
