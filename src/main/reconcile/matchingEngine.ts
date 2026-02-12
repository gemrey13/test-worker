type MatchStatus =
  | "exact_match"
  | "tolerance_match"
  | "discrepancy"
  | "unmatched";

type MatchResult = {
  pos?: any;   // full POS row
  grab?: any;  // full Grab row
  variance: number;
  status: MatchStatus;
};

function normalizeDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US");
}

function sanitizeId(str: string) {
  if (!str) return "";
  return str.toUpperCase().replace(/[0O]/g, "0").replace(/[1I]/g, "1").trim();
}

function extractPosIdFromBooking(bookingId: string) {
  if (!bookingId) return "";
  const suffix = bookingId.slice(-4);
  return `G-${suffix}`;
}

function groupBy<T>(rows: T[], keyGetter: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyGetter(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return map;
}

/**
 * Reconcile POS vs Grab transactions with tolerance and attach full row info
 */
export function reconcilePOSvsGrab(
  posRows: any[],
  grabRows: any[],
  tolerance: number = 0.01
): MatchResult[] {
  const results: MatchResult[] = [];

  const posById = groupBy(posRows, (p) => sanitizeId(p.cusno));
  const grabById = groupBy(grabRows, (g) =>
    sanitizeId(extractPosIdFromBooking(g.booking_id))
  );

  for (const [id, posGroup] of posById.entries()) {
    const grabGroup = grabById.get(id);
    if (!grabGroup) continue;

    const posByDate = groupBy(posGroup, (p) => normalizeDate(p.orddate));
    const grabByDate = groupBy(grabGroup, (g) => normalizeDate(g.created_on));

    for (const [date, posDateGroup] of posByDate.entries()) {
      const grabDateGroup = grabByDate.get(date);
      if (!grabDateGroup) continue;

      posDateGroup.sort((a, b) => Number(b.grschrg) - Number(a.grschrg));
      grabDateGroup.sort((a, b) => Number(b.amount) - Number(a.amount));

      const usedGrab = new Set<number>();

      for (const pos of posDateGroup) {
        let matched = false;

        for (const grab of grabDateGroup) {
          if (usedGrab.has(grab.id)) continue;

          const variance = Number(pos.grschrg) - Number(grab.amount);
          const absVariance = Math.abs(variance);

          if (variance === 0) {
            results.push({ pos, grab, variance: 0, status: "exact_match" });
            usedGrab.add(grab.id);
            matched = true;
            break;
          }

          if (absVariance <= tolerance) {
            results.push({ pos, grab, variance, status: "tolerance_match" });
            usedGrab.add(grab.id);
            matched = true;
            break;
          }
        }

        if (!matched) {
          results.push({ pos, grab: undefined, variance: Number(pos.grschrg), status: "unmatched" });
        }
      }

      // Remaining unused Grab rows
      for (const grab of grabDateGroup) {
        if (!usedGrab.has(grab.id)) {
          results.push({ pos: undefined, grab, variance: -Number(grab.amount), status: "unmatched" });
        }
      }
    }
  }

  return results;
}
