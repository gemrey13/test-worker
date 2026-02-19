import { ipcMain } from 'electron'
import { testReconciliation } from '../reconcile/test'

export function registerReconcileIpc() {
  ipcMain.handle('run-reconciliation', async () => {
    return testReconciliation()
  })
}
