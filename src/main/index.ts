import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'
import { initDatabase } from './db'
import fs from 'fs'
import createWorkerReader from './readerWorker?nodeWorker'
import createWorkerWriter from './writerWorker?nodeWorker'
import os from 'os'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let db: any

app.whenReady().then(() => {
  db = initDatabase()

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('start-import', async () => {
    const startTime = new Date()
    console.log(`[Main] Import started at ${startTime.toLocaleString()}`)

    const rootFolder = 'C:\\pos-data'
    const dbPath = path.join(app.getPath('userData'), 'pos.db')
    const allBranches = fs
      .readdirSync(rootFolder)
      .filter((f) => fs.statSync(path.join(rootFolder, f)).isDirectory())

    // Dynamically use all CPU cores
    const numReaders = os.cpus().length
    console.log(`[Main] Using ${numReaders} reader workers based on CPU cores`)

    const batchSize = 1000

    // Split branches among readers
    const readerGroups: string[][] = Array.from({ length: numReaders }, () => [])
    allBranches.forEach((b, i) => readerGroups[i % numReaders].push(b))

    // Start writer worker
    const writerWorker = createWorkerWriter({ workerData: { dbPath } })
    const writerPromise = new Promise<number>((resolve) => {
      writerWorker.on('message', (msg) => {
        if ('totalInserted' in msg) resolve(msg.totalInserted)
      })
    })

    // Start reader workers
    const readerPromises = readerGroups.map((group) => {
      const reader = createWorkerReader({
        workerData: { branches: group, rootFolder, batchSize }
      })
      reader.on('message', (msg) => writerWorker.postMessage(msg))
      return new Promise<void>((resolve) => reader.on('exit', () => resolve()))
    })

    await Promise.all(readerPromises)
    writerWorker.postMessage({ done: true })

    const totalInserted = await writerPromise
    const endTime = new Date()
    console.log(`[Main] Import finished at ${endTime.toLocaleString()}`)
    console.log(`[Main] Total time: ${(endTime.getTime() - startTime.getTime()) / 1000}s`)

    return { totalInserted }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (db) {
    try {
      db.close()
      console.log('[Main] Database closed.')
    } catch (err) {
      console.error('[Main] Failed to close database:', err)
    }
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
