import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { MatchResult } from './grabPOSType'
import { createBranchMapper, extractGrabToken, groupBy, normalizeCusno, normalizeDate } from './grabPOSHelper'

/**
 * Reconcile POS vs Grab transactions using branch_name/store_name, amount, and date
 */
export function reconcilePOSvsGrab(
  posRows: any[],
  grabRows: any[],
  tolerance: number = 0.01
): MatchResult[] {
  const results: MatchResult[] = []

  const dbPath = path.join(app.getPath('userData'), 'pos.db')
  const db = new Database(dbPath) // ← open DB
  const mapPosToGrabStore = createBranchMapper(db)

  // Group POS by normalized branch + date
  const posByBranchDate = groupBy(posRows, (p) => {
    const grabStore = mapPosToGrabStore(p.branch_name) ?? p.branch_name
    return `${grabStore}::${normalizeDate(p.orddate)}`
  })

  // Group Grab by store_name + date
  const grabByStoreDate = groupBy(grabRows, (g) => {
    return `${g.store_name}::${normalizeDate(g.created_on)}`
  })

  for (const [key, posGroup] of posByBranchDate.entries()) {
    const grabGroup = grabByStoreDate.get(key) || []

    const usedGrab = new Set<number>()
    const unmatchedPos: any[] = []
    const unmatchedGrab: any[] = []

    // FIRST PASS: branch + date + amount/tolerance
    posGroup.sort((a, b) => Number(b.grschrg) - Number(a.grschrg))
    grabGroup.sort((a, b) => Number(b.amount) - Number(a.amount))

    for (const pos of posGroup) {
      let matched = false

      for (const grab of grabGroup) {
        if (usedGrab.has(grab.id)) continue

        const variance = Number(pos.grschrg) - Number(grab.amount)
        const absVariance = Math.abs(variance)

        if (variance === 0) {
          results.push({ pos, grab, variance: 0, status: 'exact_match' })
          usedGrab.add(grab.id)
          matched = true
          break
        }

        if (absVariance <= tolerance) {
          results.push({ pos, grab, variance, status: 'tolerance_match' })
          usedGrab.add(grab.id)
          matched = true
          break
        }
      }

      if (!matched) unmatchedPos.push(pos)
    }

    for (const grab of grabGroup) {
      if (!usedGrab.has(grab.id)) unmatchedGrab.push(grab)
    }

    // LAST PASS: POS cusno vs Grab short_order_id / booking_id
    const remainingGrabByToken = new Map<string, any[]>()

    for (const grab of unmatchedGrab) {
      const tokens = extractGrabToken(grab)
      for (const token of tokens) {
        if (!remainingGrabByToken.has(token)) {
          remainingGrabByToken.set(token, [])
        }
        remainingGrabByToken.get(token)!.push(grab)
      }
    }

    for (const pos of unmatchedPos) {
      const cusToken = normalizeCusno(pos.cusno)
      if (!cusToken) {
        results.push({
          pos,
          grab: undefined,
          variance: Number(pos.grschrg),
          status: 'unmatched'
        })
        continue
      }

      const possibleGrabs = remainingGrabByToken.get(cusToken)
      if (possibleGrabs && possibleGrabs.length > 0) {
        const grab = possibleGrabs.shift()!
        usedGrab.add(grab.id)

        const variance = Number(pos.grschrg) - Number(grab.amount)
        results.push({
          pos,
          grab,
          variance,
          status: variance === 0 ? 'exact_match' : 'tolerance_match'
        })
      } else {
        results.push({
          pos,
          grab: undefined,
          variance: Number(pos.grschrg),
          status: 'unmatched'
        })
      }
    }

    // Any remaining Grab transactions not matched
    for (const grab of unmatchedGrab) {
      if (!usedGrab.has(grab.id)) {
        results.push({
          pos: undefined,
          grab,
          variance: -Number(grab.amount),
          status: 'unmatched'
        })
      }
    }
  }

  return results
}

function buildNotes(r: MatchResult) {
  if (r.status === 'exact_match') return 'Amounts matched exactly'
  if (r.status === 'tolerance_match') return `Within tolerance. Variance: ${r.variance.toFixed(2)}`
  if (!r.pos) return 'Missing in POS'
  if (!r.grab) return 'Missing in Grab'
  return 'Amount discrepancy'
}

export function reconcileAndSaveInline(posRows: any[], grabRows: any[], tolerance = 0.01) {
  const dbPath = path.join(app.getPath('userData'), 'pos.db')
  const db = new Database(dbPath)

  const results = reconcilePOSvsGrab(posRows, grabRows, tolerance)

  const updatePos = db.prepare(`
    UPDATE pos_transactions
    SET recon_status = ?,
        recon_grab_id = ?,
        recon_variance = ?,
        recon_notes = ?,
        recon_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  const updateGrab = db.prepare(`
    UPDATE grab_transactions
    SET recon_status = ?,
        recon_pos_id = ?,
        recon_variance = ?,
        recon_notes = ?,
        recon_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  const tx = db.transaction(() => {
    for (const r of results) {
      const notes = buildNotes(r)

      if (r.pos) {
        updatePos.run(r.status, r.grab?.id ?? null, r.variance, notes, r.pos.id)
      }

      if (r.grab) {
        updateGrab.run(r.status, r.pos?.id ?? null, r.variance, notes, r.grab.id)
      }
    }
  })

  tx()

  return results
}
