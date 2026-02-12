import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { DBFFile } from 'dbffile'
import os from 'os'

const { branches, rootFolder, batchSize } = workerData as {
  branches: string[]
  rootFolder: string
  batchSize: number
}

const ZIP_PASSWORD = 'admate'

// Format a JS Date to "MM/DD/YYYY"
function formatDateToMMDDYYYY(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const y = date.getFullYear()
  return `${m}/${d}/${y}`
}

// Sanitize generic values
function sanitizeValue(value: any) {
  if (value == null) return null
  if (value instanceof Date) return formatDateToMMDDYYYY(value)
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'bigint') return value
  if (typeof value === 'string') return value.trim()
  return value
}

// Robust numeric conversion for DBF values
function n(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const num = Number(String(v).trim())
  return isNaN(num) ? 0 : num
}

// Map DBF row to SQLite row safely
function mapRow(branch: string, row: any) {
  return {
    branch,
    cslipno: sanitizeValue(row.CSLIPNO),
    orddate: sanitizeValue(row.ORDDATE),
    ordtime: sanitizeValue(row.ORDTIME),
    cusno: sanitizeValue(row.CUSNO),
    cusname: sanitizeValue(row.CUSNAME),
    cusaddr1: sanitizeValue(row.CUSADDR1),
    cusaddr2: sanitizeValue(row.CUSADDR2),
    custel: sanitizeValue(row.CUSTEL),
    cusfax: sanitizeValue(row.CUSFAX),
    cuscont: sanitizeValue(row.CUSCONT),
    age: n(row.AGE),

    chargpct: n(row.CHARGPCT),
    grschrg: n(row.GRSCHRG),
    promo_pct: n(row.PROMO_PCT),
    promo_amt: n(row.PROMO_AMT),
    sr_tcust: n(row.SR_TCUST),
    sr_body: sanitizeValue(row.SR_BODY),
    sr_disc: n(row.SR_DISC),
    vat: n(row.VAT),
    servchrg: n(row.SERVCHRG),
    othdisc: n(row.OTHDISC),
    udisc: n(row.UDISC),
    bankcharg: n(row.BANKCHARG),
    totchrg: n(row.TOTCHRG),
    pdamt: n(row.PDAMT),
    pmtdisc: n(row.PMTDISC),
    balance: n(row.BALANCE),
    tcash: n(row.TCASH),
    tcharge: n(row.TCHARGE),
    tsigned: n(row.TSIGNED),
    vat_xmpt: n(row.VAT_XMPT),
    ntax_sal: n(row.NTAX_SAL),

    dis_prom: n(row.DIS_PROM),
    dis_udisc: n(row.DIS_UDISC),
    dis_sr: n(row.DIS_SR),
    dis_emp: n(row.DIS_EMP),
    dis_vip: n(row.DIS_VIP),
    dis_gpc: n(row.DIS_GPC),
    dis_pwd: n(row.DIS_PWD),
    dis_g: n(row.DIS_G),
    dis_h: n(row.DIS_H),
    dis_i: n(row.DIS_I),
    dis_j: n(row.DIS_J),
    dis_k: n(row.DIS_K),
    dis_l: n(row.DIS_L),
    dis_vx: n(row.DIS_VX),

    terms: sanitizeValue(row.TERMS),
    cardno: sanitizeValue(row.CARDNO),
    cardtyp: sanitizeValue(row.CARDTYP),
    lastpd: sanitizeValue(row.LASTPD),
    remarks: sanitizeValue(row.REMARKS),
    filler1: sanitizeValue(row.FILLER1),
    filler2: sanitizeValue(row.FILLER2)
  }
}

// Only include PANDA or GRAB from 2026
function isValidRow(row: any) {
  const rawDate = row.ORDDATE
  const rawName = row.CUSNAME
  if (!rawDate || !rawName) return false

  let year: number | null = null
  if (rawDate instanceof Date) year = rawDate.getFullYear()
  else if (typeof rawDate === 'string' && rawDate.length >= 4)
    year = Number(rawDate.substring(0, 4))
  if (year !== 2026) return false

  const name = String(rawName).toUpperCase().trim()
  return name === 'PANDA' || name === 'GRAB'
}

// Process a single branch
async function processBranch(branch: string) {
  const zipPath = path.join(rootFolder, branch, '2026', '01', 'GC013126.ZIP')
  if (!fs.existsSync(zipPath)) return

  const zip = new AdmZip(zipPath)

  let branch_name: string | null = null
  const sysEntry = zip.getEntries().find((e) => e.entryName.toUpperCase() === 'SYSINFO.DBF')
  if (sysEntry) {
    const tmpSysPath = path.join(os.tmpdir(), `pos-import`, `${branch}-SYSINFO.DBF`)
    fs.writeFileSync(tmpSysPath, sysEntry.getData(ZIP_PASSWORD))

    const sysDbf = await DBFFile.open(tmpSysPath, { readMode: 'loose' })
    const sysRecords = await sysDbf.readRecords(1) // usually only 1 record
    if (sysRecords.length) branch_name = sanitizeValue(sysRecords[0].ADDR1)

    fs.unlinkSync(tmpSysPath)
  }

  const entry = zip.getEntries().find((e) => e.entryName.toUpperCase() === 'CHARGES.DBF')
  if (!entry) return

  const tmpDir = path.join(os.tmpdir(), 'pos-import')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const tmpPath = path.join(tmpDir, `${branch}-CHARGES.DBF`)
  fs.writeFileSync(tmpPath, entry.getData(ZIP_PASSWORD))

  const dbf = await DBFFile.open(tmpPath, { readMode: 'loose' })
  let batch: any[] = []
  let records: any[]

  do {
    records = await dbf.readRecords(batchSize)

    for (const row of records) {
      if (!isValidRow(row)) continue
      batch.push({
        ...mapRow(branch, row),
        branch_name // add the branch_name from SYSINFO
      })
    }

    if (batch.length >= batchSize) {
      parentPort?.postMessage({ batch, branch })
      batch = []
    }
  } while (records.length > 0)

  if (batch.length) parentPort?.postMessage({ batch, branch })

  // Clean up temp file
  fs.unlinkSync(tmpPath)
}

// Run all branches in parallel
async function run() {
  console.log(`[Reader] Started at ${new Date().toLocaleString()}`)
  await Promise.all(branches.map((branch) => processBranch(branch)))
  console.log(`[Reader] Finished at ${new Date().toLocaleString()}`)
  parentPort?.postMessage({ done: true })
}

run()
