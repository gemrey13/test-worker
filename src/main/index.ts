import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'
import { initDatabase } from './db'
import fs from 'fs'
import createPosWorkerReader from './worker/posReaderWorker?nodeWorker'
import createPosWorkerWriter from './worker/posWriterWorker?nodeWorker'
import creategrabWorkerReader from './worker/grabReaderWorker?nodeWorker'
import creategrabWorkerWriter from './worker/grabWriterWorker?nodeWorker'
import os from 'os'
import { testReconciliation } from './reconcile/test'
import { importGrabManual } from './worker/importGrabManual'
import unzipper from 'unzipper'

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

  ipcMain.handle('grab:importManual', async (_, buffer: Buffer) => {
    if (!buffer || buffer.length === 0) throw new Error('No file data provided')

    const tmpFilePath = path.join(app.getPath('temp'), `grab_${Date.now()}.xlsx`)
    fs.writeFileSync(tmpFilePath, buffer)

    try {
      const dbPath = path.join(app.getPath('userData'), 'pos.db')
      return importGrabManual({ dbPath, filePath: tmpFilePath })
    } finally {
      fs.unlink(tmpFilePath, () => {})
    }
  })

  ipcMain.handle('run-reconciliation', async () => {
    return testReconciliation()
  })

  ipcMain.handle('start-import-grab', async () => {
    const startTime = new Date()
    console.log(`[Main][Grab] Import started at ${startTime.toLocaleString()}`)

    const rootFolder = 'C:\\grab-data'
    const dbPath = path.join(app.getPath('userData'), 'pos.db')

    const allFiles = fs
      .readdirSync(rootFolder)
      .filter((f) => f.endsWith('.xlsx') || f.endsWith('.xls'))

    const numReaders = os.cpus().length
    console.log(`[Main][Grab] Using ${numReaders} reader workers`)

    const batchSize = 1000

    // Split files across workers
    const readerGroups: string[][] = Array.from({ length: numReaders }, () => [])
    allFiles.forEach((file, i) => {
      readerGroups[i % numReaders].push(file)
    })

    // Start writer worker
    const writerWorker = creategrabWorkerWriter({ workerData: { dbPath } })

    const writerPromise = new Promise<number>((resolve) => {
      writerWorker.on('message', (msg) => {
        if ('totalInserted' in msg) resolve(msg.totalInserted)
      })
    })

    // Start reader workers
    const readerPromises = readerGroups.map((group) => {
      const reader = creategrabWorkerReader({
        workerData: {
          files: group,
          rootFolder,
          batchSize
        }
      })

      reader.on('message', (msg) => writerWorker.postMessage(msg))

      return new Promise<void>((resolve) => reader.on('exit', () => resolve()))
    })

    await Promise.all(readerPromises)

    writerWorker.postMessage({ done: true })

    const totalInserted = await writerPromise

    const endTime = new Date()
    console.log(`[Main][Grab] Finished at ${endTime.toLocaleString()}`)
    console.log(`[Main][Grab] Total time: ${(endTime.getTime() - startTime.getTime()) / 1000}s`)

    return { totalInserted }
  })

  ipcMain.handle('POS:import-zip', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Zip Files', extensions: ['zip'] }]
    })

    if (canceled || filePaths.length === 0) {
      throw new Error('No zip file selected')
    }

    const zipPath = filePaths[0]

    if (!zipPath) throw new Error('No zip file provided')

    const startTime = new Date()
    console.log(`[Main] Import (ZIP) started at ${startTime.toLocaleString()}`)

    // 🔹 Extract to temp folder
    const extractDir = path.join(app.getPath('temp'), `pos_extract_${Date.now()}`)
    fs.mkdirSync(extractDir, { recursive: true })

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', resolve)
        .on('error', reject)
    })

    console.log('[Main] Zip extracted to:', extractDir)

    // 🔹 Use extracted folder as root
    const rootFolder = extractDir
    const dbPath = path.join(app.getPath('userData'), 'pos.db')

    const allBranches = fs
      .readdirSync(rootFolder)
      .filter((f) => fs.statSync(path.join(rootFolder, f)).isDirectory())

    const numReaders = os.cpus().length
    const batchSize = 1000

    const readerGroups: string[][] = Array.from({ length: numReaders }, () => [])
    allBranches.forEach((b, i) => readerGroups[i % numReaders].push(b))

    const writerWorker = createPosWorkerWriter({ workerData: { dbPath } })
    const writerPromise = new Promise<number>((resolve) => {
      writerWorker.on('message', (msg) => {
        if ('totalInserted' in msg) resolve(msg.totalInserted)
      })
    })

    const readerPromises = readerGroups.map((group) => {
      const reader = createPosWorkerReader({
        workerData: { branches: group, rootFolder, batchSize }
      })
      reader.on('message', (msg) => writerWorker.postMessage(msg))
      return new Promise<void>((resolve) => reader.on('exit', () => resolve()))
    })

    await Promise.all(readerPromises)
    writerWorker.postMessage({ done: true })

    const totalInserted = await writerPromise

    // 🔹 Cleanup extracted files
    fs.rmSync(extractDir, { recursive: true, force: true })

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
