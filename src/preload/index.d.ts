import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // minimize: () => Promise<any>
      // maximize: () => Promise<any>
      // close: () => Promise<any>

      startImportGrab: () => Promise<any>
      importGrabManual: () => Promise<any>
      importPOSZip: () => Promise<any>

      reconGrabPos: (filters?: any) => Promise<any>
      getBranches: () => Promise<string[]>
    }
  }
}
