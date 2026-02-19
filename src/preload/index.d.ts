import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      startImportGrab: () => Promise<any>
      runRecon: () => Promise<any>
      importGrabManual: () => Promise<any>
      importPOSZip: () => Promise<any>
    }
  }
}
