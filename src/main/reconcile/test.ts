import Database from 'better-sqlite3'
import { reconcilePOSvsGrab } from './matchingEngine' // your function
import { app } from 'electron'
import { join } from 'path'

const dbPath = join(app.getPath('userData'), 'pos.db')
const db = new Database(dbPath)

export function testReconciliation() {
  // 1️⃣ Fetch POS rows
  const posRows = db
    .prepare(
      `
    SELECT *
    FROM pos_transactions
    WHERE cusname = 'GRAB'
  `
    )
    .all()

  // 2️⃣ Fetch Grab rows
  const grabRows = db
    .prepare(
      `
    SELECT *
    FROM grab_transactions
  `
    )
    .all()

  console.log('POS rows:', posRows.length)
  console.log('Grab rows:', grabRows.length)

  // 3️⃣ Run reconciliation
  const results = reconcilePOSvsGrab(posRows, grabRows, 0.01)

  console.log('Results:', results.length)

  return results
}
