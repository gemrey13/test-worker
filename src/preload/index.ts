import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  startImportGrab: () => ipcRenderer.invoke('start-import-grab'),
  runRecon: () => ipcRenderer.invoke('run-reconciliation'),
  startImportGrabManual: (arrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('grab:importManual', Buffer.from(arrayBuffer)),
  importPOSZip: () => ipcRenderer.invoke('POS:import-zip')
}


if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
