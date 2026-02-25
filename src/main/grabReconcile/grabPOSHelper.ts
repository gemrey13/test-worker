import Database from 'better-sqlite3'

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