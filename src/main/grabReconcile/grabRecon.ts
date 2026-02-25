import Database from 'better-sqlite3'
import { reconcileAndSaveInline } from './matchingEngine'
import { app } from 'electron'
import { join } from 'path'
import { ReconcileFilters } from './grabPOSType'

const dbPath = join(app.getPath('userData'), 'pos.db')
const db = new Database(dbPath)

/**
 * Convert any date string or Date object to MM/DD/YYYY
 */
function formatToMMDDYYYY(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Resolve preset or user-supplied date range in MM/DD/YYYY
 */
function resolveDateRange(filters: ReconcileFilters) {
  if (filters.preset === 'today') {
    const today = new Date()
    const formatted = formatToMMDDYYYY(today)
    return { from: formatted, to: formatted }
  }

  return {
    from: filters.fromDate ? formatToMMDDYYYY(filters.fromDate) : undefined,
    to: filters.toDate ? formatToMMDDYYYY(filters.toDate) : undefined
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
export function grabPosReconciliation(filters: ReconcileFilters = {}) {
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
  // 🔹 Date filter
  if (from && to) {
    // range
    posQuery += ` AND orddate BETWEEN ? AND ?`
    grabQuery += ` AND created_on BETWEEN ? AND ?`

    posParams.push(from, to)
    grabParams.push(from, to)
  } else if (from) {
    // start only
    posQuery += ` AND orddate >= ?`
    grabQuery += ` AND created_on >= ?`

    posParams.push(from)
    grabParams.push(from)
  } else if (to) {
    // end only
    posQuery += ` AND orddate <= ?`
    grabQuery += ` AND created_on <= ?`

    posParams.push(to)
    grabParams.push(to)
  }

  // 🔹 Branch filter via mapping
  if (filters.branch) {
    // Find mapping
    const mapping = db
      .prepare(`SELECT pos_name, grab_name FROM branch_mapping WHERE grab_name = ?`)
      .get(filters.branch)

    if (mapping) {
      posQuery += ` AND branch_name = ?`
      posParams.push(mapping.pos_name)

      grabQuery += ` AND store_name = ?`
      grabParams.push(mapping.grab_name)
    }
  }

  const posRows = db.prepare(posQuery).all(posParams)
  const grabRows = db.prepare(grabQuery).all(grabParams)

  console.log('Filters:', filters)
  console.log('POS rows:', posRows.length)
  console.log('Grab rows:', grabRows.length)

  const results = reconcileAndSaveInline(posRows, grabRows, 0.01)

  console.log('Results:', results.length)

  return results
}
