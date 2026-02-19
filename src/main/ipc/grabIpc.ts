import { ipcMain, app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import creategrabWorkerReader from '../worker/grabReaderWorker?nodeWorker'
import creategrabWorkerWriter from '../worker/grabWriterWorker?nodeWorker'
import { importGrabManual } from '../worker/importGrabManual'

export function registerGrabIpc() {
  ipcMain.handle('grab:importManual', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Grab Excel file',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    })

    if (canceled || filePaths.length === 0) {
      return { totalInserted: 0, message: 'No GRAB file selected' }
    }

    let totalInserted = 0
    let messages: string[] = []

    for (const filePath of filePaths) {
      // Copy to temp folder
      const tmpFilePath = path.join(
        app.getPath('temp'),
        `grab_${Date.now()}_${path.basename(filePath)}`
      )
      fs.copyFileSync(filePath, tmpFilePath)

      try {
        const dbPath = path.join(app.getPath('userData'), 'pos.db')
        const result = importGrabManual({ dbPath, filePath: tmpFilePath })
        totalInserted += result.inserted
      } catch (err: any) {
        messages.push(`Error with ${filePath}: ${err.message}`)
      } finally {
        fs.unlink(tmpFilePath, () => {})
      }
    }

    return {
      totalInserted,
      message: 'Completed'
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
