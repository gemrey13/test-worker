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
 * Normalize POS cusno for last-pass ID matching
 */
function normalizeCusno(cusno?: string): string | null {
  if (!cusno) return null;
  return cusno.toUpperCase().replace(/^GF?-?/, "").trim();
}

/**
 * Extract possible tokens from Grab for last-pass matching
 */
function extractGrabToken(grab: any): string[] {
  const tokens: string[] = [];

  if (grab.short_order_id) {
    tokens.push(grab.short_order_id.toUpperCase().trim());
  }

  if (grab.booking_id) {
    const cleaned = grab.booking_id.toUpperCase().trim();
    tokens.push(cleaned.slice(-4));
    tokens.push(cleaned.slice(-5));
    tokens.push(cleaned.slice(-6));
  }

  return tokens;
}

/**
 * Fetch branch mappings from the database and return a lookup function
 */
export function createBranchMapper(db: Database.Database) {
  const rows: { pos_code: string; pos_name: string; grab_name: string | null }[] =
    db.prepare("SELECT pos_code, pos_name, grab_name FROM branch_mapping").all();

  return (posBranch: string): string | null => {
    const mapping = rows.find(
      (b) =>
        b.pos_name.toLowerCase().includes(posBranch.toLowerCase()) ||
        b.pos_code === posBranch
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

  const dbPath = path.join(app.getPath("userData"), "pos.db");
  const db = new Database(dbPath); // ← open DB
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
    const grabGroup = grabByStoreDate.get(key) || [];

    const usedGrab = new Set<number>();
    const unmatchedPos: any[] = [];
    const unmatchedGrab: any[] = [];

    // FIRST PASS: branch + date + amount/tolerance
    posGroup.sort((a, b) => Number(b.grschrg) - Number(a.grschrg));
    grabGroup.sort((a, b) => Number(b.amount) - Number(a.amount));

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

      if (!matched) unmatchedPos.push(pos);
    }

    for (const grab of grabGroup) {
      if (!usedGrab.has(grab.id)) unmatchedGrab.push(grab);
    }

    // LAST PASS: POS cusno vs Grab short_order_id / booking_id
    const remainingGrabByToken = new Map<string, any[]>();

    for (const grab of unmatchedGrab) {
      const tokens = extractGrabToken(grab);
      for (const token of tokens) {
        if (!remainingGrabByToken.has(token)) {
          remainingGrabByToken.set(token, []);
        }
        remainingGrabByToken.get(token)!.push(grab);
      }
    }

    for (const pos of unmatchedPos) {
      const cusToken = normalizeCusno(pos.cusno);
      if (!cusToken) {
        results.push({
          pos,
          grab: undefined,
          variance: Number(pos.grschrg),
          status: "unmatched",
        });
        continue;
      }

      const possibleGrabs = remainingGrabByToken.get(cusToken);
      if (possibleGrabs && possibleGrabs.length > 0) {
        const grab = possibleGrabs.shift()!;
        usedGrab.add(grab.id);

        const variance = Number(pos.grschrg) - Number(grab.amount);
        results.push({
          pos,
          grab,
          variance,
          status: variance === 0 ? "exact_match" : "tolerance_match",
        });
      } else {
        results.push({
          pos,
          grab: undefined,
          variance: Number(pos.grschrg),
          status: "unmatched",
        });
      }
    }

    // Any remaining Grab transactions not matched
    for (const grab of unmatchedGrab) {
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
