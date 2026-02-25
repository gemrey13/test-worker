import { ipcMain } from 'electron'
import { getGrabBranchOptions, grabPosReconciliation } from '../grabReconcile/grabRecon'

export function registerReconcileIpc() {
  ipcMain.handle('recon:grab-pos', async (_, filters) => {
    return grabPosReconciliation(filters)
  })

  ipcMain.handle('get-grab-branches', async () => {
    return getGrabBranchOptions()
  })
}
