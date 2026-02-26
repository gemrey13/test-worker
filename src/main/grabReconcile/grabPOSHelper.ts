import Database from 'better-sqlite3'
import { GroupedReconcileResults, MatchResult } from './grabPOSType'
import { branchMappings } from '../branches'

export function normalizeDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US')
}

export function groupBy<T>(rows: T[], keyGetter: (row: T) => string) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyGetter(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return map
}

/**
 * Fetch branch mappings from the database and return a lookup function
 */
export function createBranchMapper(db: Database.Database) {
  const rows: { pos_code: string; pos_name: string; grab_name: string | null }[] = db
    .prepare('SELECT pos_code, pos_name, grab_name FROM branch_mapping')
    .all()

  return (posBranch: string): string | null => {
    const mapping = rows.find(
      (b) => b.pos_name.toLowerCase().includes(posBranch.toLowerCase()) || b.pos_code === posBranch
    )
    return mapping?.grab_name ?? null
  }
}

/**
 * Normalize POS cusno for last-pass ID matching
 */
export function normalizeCusno(cusno?: string): string | null {
  if (!cusno) return null
  return cusno
    .toUpperCase()
    .replace(/^GF?-?/, '')
    .trim()
}

/**
 * Extract possible tokens from Grab for last-pass matching
 */
export function extractGrabToken(grab: any): string[] {
  const tokens: string[] = []

  if (grab.short_order_id) {
    tokens.push(grab.short_order_id.toUpperCase().trim())
  }

  if (grab.booking_id) {
    const cleaned = grab.booking_id.toUpperCase().trim()
    tokens.push(cleaned.slice(-4))
    tokens.push(cleaned.slice(-5))
    tokens.push(cleaned.slice(-6))
  }

  return tokens
}

/**
 * Convert any date string or Date object to MM/DD/YYYY
 */
export function formatToMMDDYYYY(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export function groupResultsByBranchAndDate(results: MatchResult[]): GroupedReconcileResults {
  const map = new Map<string, { branch: string; date: string; items: MatchResult[] }>()

  for (const r of results) {
    // Normalize branch using branchMappings
    let rawBranch = r.grab?.store_name ?? r.pos?.branch_name ?? 'Unknown Branch'

    const mapping = branchMappings.find(
      (b) => b.posName === r.pos?.branch_name || b.grabName === r.grab?.store_name
    )

    const branch = mapping?.grabName ?? rawBranch

    const date = r.grab?.created_on ?? r.pos?.orddate ?? 'Unknown Date'

    const key = `${branch}|${date}`

    if (!map.has(key)) {
      map.set(key, { branch, date, items: [] })
    }

    map.get(key)!.items.push(r)
  }

  return Array.from(map.values()).map((group) => {
    const totalCount = group.items.length
    const exactCount = group.items.filter((i) => i.status === 'exact_match').length
    const issueCount = totalCount - exactCount

    const matchRate = totalCount === 0 ? 0 : Number(((exactCount / totalCount) * 100).toFixed(2))

    return {
      ...group,
      issueCount,
      matchRate,
      totalCount,
      exactCount
    }
  })
}
