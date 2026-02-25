import { ipcMain } from 'electron'
import { getBranchOptions, grabPosReconciliation } from '../grabReconcile/grabRecon'

export function registerReconcileIpc() {
  ipcMain.handle('recon:grab-pos', async (_, filters) => {
    return grabPosReconciliation(filters)
  })

  ipcMain.handle('get-branches', async () => {
    return getBranchOptions()
  })
}
