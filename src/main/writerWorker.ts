import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

const { dbPath } = workerData as { dbPath: string }
const db = new Database(dbPath)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = OFF;
  PRAGMA cache_size = -100000;
  PRAGMA temp_store = MEMORY;
`)

// Prepared statement
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO pos_transactions (
    branch, branch_name, cslipno, orddate, ordtime,
    cusno, cusname, cusaddr1, cusaddr2, custel, cusfax, cuscont, age,
    chargpct, grschrg, promo_pct, promo_amt, sr_tcust, sr_body, sr_disc,
    vat, servchrg, othdisc, udisc, bankcharg, totchrg, pdamt, pmtdisc, balance,
    tcash, tcharge, tsigned, vat_xmpt, ntax_sal,
    dis_prom, dis_udisc, dis_sr, dis_emp, dis_vip, dis_gpc, dis_pwd, dis_g,
    dis_h, dis_i, dis_j, dis_k, dis_l, dis_vx,
    terms, cardno, cardtyp, lastpd, remarks, filler1, filler2
  ) VALUES (
    @branch, @branch_name, @cslipno, @orddate, @ordtime,
    @cusno, @cusname, @cusaddr1, @cusaddr2, @custel, @cusfax, @cuscont, @age,
    @chargpct, @grschrg, @promo_pct, @promo_amt, @sr_tcust, @sr_body, @sr_disc,
    @vat, @servchrg, @othdisc, @udisc, @bankcharg, @totchrg, @pdamt, @pmtdisc, @balance,
    @tcash, @tcharge, @tsigned, @vat_xmpt, @ntax_sal,
    @dis_prom, @dis_udisc, @dis_sr, @dis_emp, @dis_vip, @dis_gpc, @dis_pwd, @dis_g,
    @dis_h, @dis_i, @dis_j, @dis_k, @dis_l, @dis_vx,
    @terms, @cardno, @cardtyp, @lastpd, @remarks, @filler1, @filler2
  )
`)

let totalInserted = 0

// Receive batches from reader workers
parentPort?.on('message', (msg: { batch?: any[], branch?: string, done?: boolean }) => {
  if (msg.batch && msg.batch.length) {
    const transaction = db.transaction((rows: any[]) => {
      for (const row of rows) insertStmt.run(row)
    })
    transaction(msg.batch)
    totalInserted += msg.batch.length

    console.log(`[Writer][${msg.branch}] Inserted batch of ${msg.batch.length}, total: ${totalInserted}`)
  }

  if (msg.done) {
    console.log(`[Writer] All done, total inserted: ${totalInserted}`)
    parentPort?.postMessage({ totalInserted })
  }
})
