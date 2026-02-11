import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'pos.db')

  const exists = fs.existsSync(dbPath)
  db = new Database(dbPath)

  if (!exists) {
    console.log('Creating database...')

    db.exec(`
      CREATE TABLE IF NOT EXISTS pos_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch TEXT,

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
        filler2 TEXT
      );
    `)
  }

  return db
}
