import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { BranchMapping, branchMappings } from './branches'

let db: Database.Database

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'pos.db')
  console.log('[DB] Initializing at:', dbPath)

  const exists = fs.existsSync(dbPath)
  console.log('[DB] File exists before init?', exists)

  db = new Database(dbPath)

  // 🔹 Always enable WAL and performance PRAGMAs
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -100000;
    PRAGMA temp_store = MEMORY;
  `)

  // 🔹 Always create tables if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS pos_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch TEXT,
      branch_name TEXT,
      cslipno TEXT,
      orddate TEXT,
      ordtime TEXT,
      cusno TEXT,
      cusname TEXT,
      cusaddr1 TEXT,
      cusaddr2 TEXT,
      custel TEXT,
      cusfax TEXT,
      cuscont TEXT,
      age TEXT,
      chargpct REAL DEFAULT 0,
      grschrg REAL DEFAULT 0,
      promo_pct REAL DEFAULT 0,
      promo_amt REAL DEFAULT 0,
      sr_tcust INTEGER DEFAULT 0,
      sr_body TEXT,
      sr_disc REAL DEFAULT 0,
      vat REAL DEFAULT 0,
      servchrg REAL DEFAULT 0,
      othdisc REAL DEFAULT 0,
      udisc REAL DEFAULT 0,
      bankcharg REAL DEFAULT 0,
      totchrg REAL DEFAULT 0,
      pdamt REAL DEFAULT 0,
      pmtdisc REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      tcash REAL DEFAULT 0,
      tcharge REAL DEFAULT 0,
      tsigned REAL DEFAULT 0,
      vat_xmpt REAL DEFAULT 0,
      ntax_sal REAL DEFAULT 0,
      dis_prom REAL DEFAULT 0,
      dis_udisc REAL DEFAULT 0,
      dis_sr REAL DEFAULT 0,
      dis_emp REAL DEFAULT 0,
      dis_vip REAL DEFAULT 0,
      dis_gpc REAL DEFAULT 0,
      dis_pwd REAL DEFAULT 0,
      dis_g REAL DEFAULT 0,
      dis_h REAL DEFAULT 0,
      dis_i REAL DEFAULT 0,
      dis_j REAL DEFAULT 0,
      dis_k REAL DEFAULT 0,
      dis_l REAL DEFAULT 0,
      dis_vx REAL DEFAULT 0,
      terms TEXT,
      cardno TEXT,
      cardtyp TEXT,
      lastpd TEXT,
      remarks TEXT,
      filler1 TEXT,
      filler2 TEXT,
      UNIQUE(branch, cslipno)
    );

    CREATE TABLE IF NOT EXISTS grab_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_name TEXT,
      merchant_id TEXT,
      store_name TEXT,
      store_id TEXT,
      updated_on TEXT,
      created_on TEXT,
      type TEXT,
      category TEXT,
      receiving_account TEXT,
      subcategory TEXT,
      status TEXT,
      transaction_id TEXT,
      linked_transaction_id TEXT,
      partner_transaction_id_1 TEXT,
      partner_transaction_id_2 TEXT,
      long_order_id TEXT,
      short_order_id TEXT,
      booking_id TEXT UNIQUE,
      order_channel TEXT,
      order_type TEXT,
      payment_method TEXT,
      terminal_id TEXT,
      channel TEXT,
      offer_type TEXT,
      grab_fee_percent REAL,
      points_multiplier REAL,
      points_issued REAL,
      settlement_id TEXT,
      transfer_date TEXT,
      amount REAL,
      tax_on_order_value REAL,
      packaging_charge REAL,
      non_member_fee REAL,
      service_charge REAL,
      offer REAL,
      discount_merchant REAL,
      delivery_fee_discount REAL,
      delivery_charge_gos REAL,
      delivery_charge_merchant REAL,
      grabexpress_fee REAL,
      net_sales REAL,
      net_mdr REAL,
      tax_on_mdr REAL,
      grab_fee REAL,
      marketing_success_fee REAL,
      delivery_commission REAL,
      channel_commission REAL,
      order_commission REAL,
      grabfood_other_commission REAL,
      grabkitchen_commission REAL,
      grabkitchen_other_commission REAL,
      withholding_tax REAL,
      total REAL,
      cancellation_reason TEXT,
      cancelled_by TEXT,
      reason_for_refund TEXT,
      description TEXT,
      incident_group TEXT,
      incident_alias TEXT,
      customer_refund_item TEXT,
      appeal_link TEXT,
      appeal_status TEXT
    );

    CREATE TABLE IF NOT EXISTS branch_mapping (
      pos_code TEXT PRIMARY KEY,
      pos_name TEXT,
      grab_name TEXT
    );
  `)

  console.log('[DB] Tables ensured.')

  seedBranchMapping(branchMappings)

  return db
}

function seedBranchMapping(mappings: BranchMapping[]) {
  const insert = db.prepare(`
    INSERT INTO branch_mapping (pos_code, pos_name, grab_name)
    VALUES (?, ?, ?)
    ON CONFLICT(pos_code) DO UPDATE SET
      pos_name = excluded.pos_name,
      grab_name = excluded.grab_name
  `)

  const insertMany = db.transaction((rows: BranchMapping[]) => {
    for (const row of rows) {
      insert.run(row.posCode, row.posName, row.grabName)
    }
  })

  insertMany(mappings)
}
