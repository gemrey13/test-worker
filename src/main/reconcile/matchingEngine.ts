import { branchMappings } from "../branches";

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
 * Attempt to map POS branch_name to Grab store_name using branchMappings
 */
function mapPosToGrabStore(posBranch: string): string | null {
  const mapping = branchMappings.find(
    (b) => b.posName.toLowerCase().includes(posBranch.toLowerCase()) || b.posCode === posBranch
  );
  return mapping?.grabName ?? null;
}

/**
 * Reconcile POS vs Grab transactions using branch_name/store_name, amount, and date
 */
export function reconcilePOSvsGrab(
  posRows: any[],
  grabRows: any[],
  tolerance: number = 0.01
): MatchResult[] {
  const results: MatchResult[] = [];

  // Group POS by normalized branch + date
  const posByBranchDate = groupBy(posRows, (p) => {
    const grabStore = mapPosToGrabStore(p.branch_name) ?? p.branch_name;
    return `${grabStore}::${normalizeDate(p.orddate)}`;
  });

  // Group Grab by store_name + date
  const grabByStoreDate = groupBy(grabRows, (g) => {
    return `${g.store_name}::${normalizeDate(g.created_on)}`;
  });

  for (const [key, posGroup] of posByBranchDate.entries()) {
    const grabGroup = grabByStoreDate.get(key);
    if (!grabGroup) {
      // No matching Grab transactions for this branch+date
      for (const pos of posGroup) {
        results.push({ pos, grab: undefined, variance: Number(pos.grschrg), status: "unmatched" });
      }
      continue;
    }

    posGroup.sort((a, b) => Number(b.grschrg) - Number(a.grschrg));
    grabGroup.sort((a, b) => Number(b.amount) - Number(a.amount));

    const usedGrab = new Set<number>();

    for (const pos of posGroup) {
      let matched = false;

      for (const grab of grabGroup) {
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

    // Any remaining Grab transactions not used
    for (const grab of grabGroup) {
      if (!usedGrab.has(grab.id)) {
        results.push({ pos: undefined, grab, variance: -Number(grab.amount), status: "unmatched" });
      }
    }
  }

  return results;
}
