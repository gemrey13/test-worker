import { parentPort, workerData } from 'worker_threads'
import path from 'path'
import * as XLSX from 'xlsx'

const { files, rootFolder, batchSize } = workerData as {
  files: string[]
  rootFolder: string
  batchSize: number
}

function n(v: any): number {
  if (!v) return 0
  const num = Number(String(v).replace(/,/g, '').trim())
  return isNaN(num) ? 0 : num
}

function sanitize(v: any) {
  if (v == null) return null
  return String(v).trim()
}
function formatDate(v: any): string | null {
  if (!v) return null

  // If it's a Date object (from Excel), convert it
  let date: Date
  if (v instanceof Date) {
    date = v
  } else {
    // Try parsing string or number
    const parsed = new Date(v)
    if (isNaN(parsed.getTime())) return null
    date = parsed
  }

  // MM/DD/YYYY
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()

  return `${mm}/${dd}/${yyyy}`
}

function mapRow(row: any) {
  return {
    merchant_name: sanitize(row['Merchant Name']),
    merchant_id: sanitize(row['Merchant ID']),
    store_name: sanitize(row['Store Name']),
    store_id: sanitize(row['Store ID']),
    updated_on: formatDate(row['Updated On']),
    created_on: formatDate(row['Created On']),
    type: sanitize(row['Type']),
    category: sanitize(row['Category']),
    receiving_account: sanitize(row['Receiving account / Source of fund']),
    subcategory: sanitize(row['Subcategory']),
    status: sanitize(row['Status']),
    transaction_id: sanitize(row['Transaction ID']),
    linked_transaction_id: sanitize(row['Linked Transaction ID']),
    partner_transaction_id_1: sanitize(row['Partner transaction ID 1']),
    partner_transaction_id_2: sanitize(row['Partner transaction ID 2']),
    long_order_id: sanitize(row['Long Order ID']),
    short_order_id: sanitize(row['Short Order ID']),
    booking_id: sanitize(row['Booking ID']),
    order_channel: sanitize(row['Order Channel']),
    order_type: sanitize(row['Order Type']),
    payment_method: sanitize(row['Payment Method']),
    terminal_id: sanitize(row['Terminal ID']),
    channel: sanitize(row['Channel']),
    offer_type: sanitize(row['Offer Type']),

    grab_fee_percent: n(row['Grab Fee (%)']),
    points_multiplier: n(row['Points Multiplier']),
    points_issued: n(row['Points Issued']),
    settlement_id: sanitize(row['Settlement ID']),
    transfer_date: formatDate(row['Transfer Date']), // optional: same format

    amount: n(row['Amount']),
    tax_on_order_value: n(row['Tax on Order Value']),
    packaging_charge: n(row['Restaurant Packaging Charge']),
    non_member_fee: n(row['Non-Member Fee']),
    service_charge: n(row['Restaurant Service Charge']),
    offer: n(row['Offer']),
    discount_merchant: n(row['Discount (Merchant-Funded)']),
    delivery_fee_discount: n(row['Delivery Fee Discount (Merchant-Funded)']),
    delivery_charge_gos: n(row['Delivery Charge (Grab Online Store)']),
    delivery_charge_merchant: n(row['Delivery Charge (Merchant Delivery)']),
    grabexpress_fee: n(row['GrabExpress Delivery Service Fee']),
    net_sales: n(row['Net Sales']),
    net_mdr: n(row['Net MDR']),
    tax_on_mdr: n(row['Tax on MDR']),
    grab_fee: n(row['Grab Fee']),
    marketing_success_fee: n(row['Marketing success fee']),
    delivery_commission: n(row['Delivery Commission']),
    channel_commission: n(row['Channel Commission']),
    order_commission: n(row['Order commission']),
    grabfood_other_commission: n(row['GrabFood / GrabMart Other Commission']),
    grabkitchen_commission: n(row['GrabKitchen Commission']),
    grabkitchen_other_commission: n(row['GrabKitchen Other Commission']),
    withholding_tax: n(row['Withholding Tax']),
    total: n(row['Total']),

    cancellation_reason: sanitize(row['Cancellation Reason']),
    cancelled_by: sanitize(row['Cancelled by']),
    reason_for_refund: sanitize(row['Reason for Refund']),
    description: sanitize(row['Description']),
    incident_group: sanitize(row['Incident group']),
    incident_alias: sanitize(row['Incident alias']),
    customer_refund_item: sanitize(row['Customer refund Item']),
    appeal_link: sanitize(row['Appeal link']),
    appeal_status: sanitize(row['Appeal status'])
  }
}

async function run() {
  console.log(`[Grab Reader] Started with ${files.length} files`)

  for (const file of files) {
    const fullPath = path.join(rootFolder, file)
    const workbook = XLSX.readFile(fullPath)

    const sheet = workbook.Sheets['Transactions']
    if (!sheet) continue

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet)

    let batch: any[] = []

    for (const row of rows) {
      if (!row['Booking ID']) continue

      batch.push(mapRow(row))

      if (batch.length >= batchSize) {
        parentPort?.postMessage({ batch, source: 'grab' })
        batch = []
      }
    }

    if (batch.length) {
      parentPort?.postMessage({ batch, source: 'grab' })
    }

    console.log(`[Grab Reader] Finished file ${file}`)
  }

  parentPort?.postMessage({ done: true })
}

run()
