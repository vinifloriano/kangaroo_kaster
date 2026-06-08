import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  permissions: {
    getMicrophoneStatus: (): Promise<string> =>
      ipcRenderer.invoke('permissions:getMicrophoneStatus'),
    requestMicrophone: (): Promise<string> =>
      ipcRenderer.invoke('permissions:requestMicrophone'),
    getScreenCaptureStatus: (): Promise<string> =>
      ipcRenderer.invoke('permissions:getScreenCaptureStatus')
  },
  drivers: {
    checkStatus: (): Promise<{ installed: boolean; type: string; message: string }> =>
      ipcRenderer.invoke('drivers:checkStatus'),
    install: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('drivers:install'),
    onInstallProgress: (callback: (data: { log: string }) => void) => {
      const listener = (_event: unknown, data: { log: string }) => callback(data)
      ipcRenderer.on('drivers:install-progress', listener)
      return () => {
        ipcRenderer.removeListener('drivers:install-progress', listener)
      }
    }
  },
  apps: {
    getSources: (): Promise<{ id: string; name: string }[]> =>
      ipcRenderer.invoke('apps:getSources'),
    setCaptureSource: (sourceId: string): Promise<void> =>
      ipcRenderer.invoke('apps:setCaptureSource', sourceId)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore - Expose to global window in non-isolated contexts
  window.electron = electronAPI
  // @ts-ignore - Expose to global window in non-isolated contexts
  window.api = api
}
