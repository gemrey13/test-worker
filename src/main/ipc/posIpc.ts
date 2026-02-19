import { ipcMain, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import unzipper from 'unzipper'
import createPosWorkerReader from '../worker/posReaderWorker?nodeWorker'
import createPosWorkerWriter from '../worker/posWriterWorker?nodeWorker'

export function registerPosIpc() {
  ipcMain.handle('POS:importZip', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Zip Files', extensions: ['zip'] }]
    })

    if (canceled || filePaths.length === 0) {
      return { totalInserted: 0, message: 'No POS file selected' }
    }

    const zipPath = filePaths[0]
    const startTime = new Date()
    console.log(`[Main] Import (ZIP) started at ${startTime.toLocaleString()}`)

    const extractDir = path.join(app.getPath('temp'), `pos_extract_${Date.now()}`)
    fs.mkdirSync(extractDir, { recursive: true })

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', resolve)
        .on('error', reject)
    })

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

    fs.rmSync(extractDir, { recursive: true, force: true })

    const endTime = new Date()
    console.log(`[Main] Import finished at ${endTime.toLocaleString()}`)
    console.log(`[Main] Total time: ${(endTime.getTime() - startTime.getTime()) / 1000}s`)

    return { totalInserted, message: 'Added POS file' }
  })
}
