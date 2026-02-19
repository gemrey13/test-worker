import { registerPosIpc } from './posIpc'
import { registerGrabIpc } from './grabIpc'
import { registerReconcileIpc } from './reconcileIpc'

export function registerAllIpc() {
  registerPosIpc()
  registerGrabIpc()
  registerReconcileIpc()
}
