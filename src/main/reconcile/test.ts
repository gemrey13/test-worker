import Database from 'better-sqlite3'
import { reconcilePOSvsGrab } from './matchingEngine'
import { app } from 'electron'
import { join } from 'path'

const dbPath = join(app.getPath('userData'), 'pos.db')
const db = new Database(dbPath)

export type ReconcileFilters = {
  branch?: string // grab_name
  fromDate?: string // ISO YYYY-MM-DD
  toDate?: string
  preset?: 'today'
}

/**
 * Utility to resolve preset dates
 */
function resolveDateRange(filters: ReconcileFilters) {
  if (filters.preset === 'today') {
    const today = new Date()
    const iso = today.toISOString().slice(0, 10)
    return { from: iso, to: iso }
  }

  return {
    from: filters.fromDate,
    to: filters.toDate
  }
}

export function getBranchOptions() {
  return db
    .prepare(
      `
      SELECT grab_name
      FROM branch_mapping
      WHERE grab_name IS NOT NULL
      ORDER BY grab_name
    `
    )
    .all()
    .map((r) => r.grab_name)
}

/**
 * Main test reconciliation with filters
 */
export function testReconciliation(filters: ReconcileFilters = {}) {
  const { from, to } = resolveDateRange(filters)

  let posQuery = `
    SELECT *
    FROM pos_transactions
    WHERE cusname = 'GRAB'
  `

  let grabQuery = `
    SELECT *
    FROM grab_transactions
    WHERE 1=1
  `

  const posParams: any[] = []
  const grabParams: any[] = []

  // 🔹 Date filter
  if (from && to) {
    posQuery += ` AND DATE(orddate) BETWEEN DATE(?) AND DATE(?)`
    grabQuery += ` AND DATE(created_on) BETWEEN DATE(?) AND DATE(?)`

    posParams.push(from, to)
    grabParams.push(from, to)
  }

  // 🔹 Branch filter (Grab only)
  if (filters.branch) {
    grabQuery += ` AND store_name = ?`
    grabParams.push(filters.branch)
  }

  const posRows = db.prepare(posQuery).all(posParams)
  const grabRows = db.prepare(grabQuery).all(grabParams)

  console.log('Filters:', filters)
  console.log('POS rows:', posRows.length)
  console.log('Grab rows:', grabRows.length)

  const results = reconcilePOSvsGrab(posRows, grabRows, 0.01)

  console.log('Results:', results.length)

  return results
}
