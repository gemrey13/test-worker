import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  startImportGrab: () => ipcRenderer.invoke('start-import-grab'),
  runRecon: () => ipcRenderer.invoke('run-reconciliation'),
  importGrabManual: () => ipcRenderer.invoke('grab:importManual'),
  importPOSZip: () => ipcRenderer.invoke('POS:importZip'),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close')
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
