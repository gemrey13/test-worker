import { ipcMain } from 'electron'
import { getBranchOptions, testReconciliation } from '../reconcile/test'

export function registerReconcileIpc() {
  ipcMain.handle('run-reconciliation', async () => {
    return testReconciliation()
  })

  ipcMain.handle('run', async (_, filters) => {
    return testReconciliation(filters)
  })

  ipcMain.handle('get-branches', async () => {
    return getBranchOptions()
  })
}
