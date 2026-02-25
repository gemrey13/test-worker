import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // minimize: () => ipcRenderer.send('window-minimize'),
  // maximize: () => ipcRenderer.send('window-maximize'),
  // close: () => ipcRenderer.send('window-close')

  startImportGrab: () => ipcRenderer.invoke('start-import-grab'),
  importGrabManual: () => ipcRenderer.invoke('grab:importManual'),
  importPOSZip: () => ipcRenderer.invoke('POS:importZip'),

  reconGrabPos: (filters?: any) => ipcRenderer.invoke('recon:grab-pos', filters),
  getBranches: () => ipcRenderer.invoke('get-branches')
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
