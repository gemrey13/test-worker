import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      startImport: () => Promise<any>;
      startImportGrab: () => Promise<any>;
      runRecon: () => Promise<any>;
      startImportGrabManual: (buffer: any) => Promise<any>
    }
  }
}
