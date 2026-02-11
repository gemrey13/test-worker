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
  INSERT INTO pos_transactions (
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
  ON CONFLICT(branch, cslipno)
  DO UPDATE SET
    branch_name = excluded.branch_name,
    orddate = excluded.orddate,
    ordtime = excluded.ordtime,
    cusno = excluded.cusno,
    cusname = excluded.cusname,
    cusaddr1 = excluded.cusaddr1,
    cusaddr2 = excluded.cusaddr2,
    custel = excluded.custel,
    cusfax = excluded.cusfax,
    cuscont = excluded.cuscont,
    age = excluded.age,
    chargpct = excluded.chargpct,
    grschrg = excluded.grschrg,
    promo_pct = excluded.promo_pct,
    promo_amt = excluded.promo_amt,
    sr_tcust = excluded.sr_tcust,
    sr_body = excluded.sr_body,
    sr_disc = excluded.sr_disc,
    vat = excluded.vat,
    servchrg = excluded.servchrg,
    othdisc = excluded.othdisc,
    udisc = excluded.udisc,
    bankcharg = excluded.bankcharg,
    totchrg = excluded.totchrg,
    pdamt = excluded.pdamt,
    pmtdisc = excluded.pmtdisc,
    balance = excluded.balance,
    tcash = excluded.tcash,
    tcharge = excluded.tcharge,
    tsigned = excluded.tsigned,
    vat_xmpt = excluded.vat_xmpt,
    ntax_sal = excluded.ntax_sal,
    dis_prom = excluded.dis_prom,
    dis_udisc = excluded.dis_udisc,
    dis_sr = excluded.dis_sr,
    dis_emp = excluded.dis_emp,
    dis_vip = excluded.dis_vip,
    dis_gpc = excluded.dis_gpc,
    dis_pwd = excluded.dis_pwd,
    dis_g = excluded.dis_g,
    dis_h = excluded.dis_h,
    dis_i = excluded.dis_i,
    dis_j = excluded.dis_j,
    dis_k = excluded.dis_k,
    dis_l = excluded.dis_l,
    dis_vx = excluded.dis_vx,
    terms = excluded.terms,
    cardno = excluded.cardno,
    cardtyp = excluded.cardtyp,
    lastpd = excluded.lastpd,
    remarks = excluded.remarks,
    filler1 = excluded.filler1,
    filler2 = excluded.filler2
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
