import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import creategrabWorkerReader from '../worker/grabReaderWorker?nodeWorker'
import creategrabWorkerWriter from '../worker/grabWriterWorker?nodeWorker'
import { importGrabManual } from '../worker/importGrabManual'

export function registerGrabIpc() {
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

    const readerGroups: string[][] = Array.from({ length: numReaders }, () => [])
    allFiles.forEach((file, i) => readerGroups[i % numReaders].push(file))

    const writerWorker = creategrabWorkerWriter({ workerData: { dbPath } })
    const writerPromise = new Promise<number>((resolve) => {
      writerWorker.on('message', (msg) => {
        if ('totalInserted' in msg) resolve(msg.totalInserted)
      })
    })

    const readerPromises = readerGroups.map((group) => {
      const reader = creategrabWorkerReader({
        workerData: { files: group, rootFolder, batchSize }
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
}
