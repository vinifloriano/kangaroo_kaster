import { ElectronAPI } from '@electron-toolkit/preload'

interface PermissionsAPI {
  getMicrophoneStatus: () => Promise<string>
  requestMicrophone: () => Promise<string>
  getScreenCaptureStatus: () => Promise<string>
}

interface DriverStatus {
  installed: boolean
  type: string
  message: string
}

interface DriversAPI {
  checkStatus: () => Promise<DriverStatus>
  install: () => Promise<{ success: boolean; error?: string }>
  onInstallProgress: (callback: (data: { log: string }) => void) => () => void
}

interface AppsAPI {
  getSources: () => Promise<{ id: string; name: string }[]>
  setCaptureSource: (sourceId: string) => Promise<void>
}

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
}

interface API {
  permissions: PermissionsAPI
  drivers: DriversAPI
  apps: AppsAPI
  window: WindowAPI
  platform: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
