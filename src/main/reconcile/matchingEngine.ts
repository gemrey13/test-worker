import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

type MatchStatus =
  | "exact_match"
  | "tolerance_match"
  | "discrepancy"
  | "unmatched";

type MatchResult = {
  pos?: any;
  grab?: any;
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
 * Fetch branch mappings from the database and return a lookup function
 */
export function createBranchMapper(db: Database.Database) {
  const rows: { pos_code: string; pos_name: string; grab_name: string | null }[] =
    db.prepare("SELECT pos_code, pos_name, grab_name FROM branch_mapping").all();

  return (posBranch: string): string | null => {
    const mapping = rows.find(
      (b) => b.pos_name.toLowerCase().includes(posBranch.toLowerCase()) || b.pos_code === posBranch
    );
    return mapping?.grab_name ?? null;
  };
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

  const dbPath = path.join(app.getPath('userData'), 'pos.db')
  const db = new Database(dbPath); // ← this is the key
  // Use DB-based branch mapper
  const mapPosToGrabStore = createBranchMapper(db);

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
      for (const pos of posGroup) {
        results.push({
          pos,
          grab: undefined,
          variance: Number(pos.grschrg),
          status: "unmatched",
        });
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
        results.push({
          pos,
          grab: undefined,
          variance: Number(pos.grschrg),
          status: "unmatched",
        });
      }
    }

    for (const grab of grabGroup) {
      if (!usedGrab.has(grab.id)) {
        results.push({
          pos: undefined,
          grab,
          variance: -Number(grab.amount),
          status: "unmatched",
        });
      }
    }
  }

  return results;
}
