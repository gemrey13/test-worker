import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'

export type ImportGrabManualOptions = {
  dbPath: string
  filePath: string
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
  const date = v instanceof Date ? v : new Date(v)
  if (isNaN(date.getTime())) return null

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
    transfer_date: formatDate(row['Transfer Date']),

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

export function importGrabManual({ dbPath, filePath }: ImportGrabManualOptions) {
  const db = new Database(dbPath)

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
  `)

  const insertStmt = db.prepare(`
    INSERT INTO grab_transactions (
      merchant_name, merchant_id, store_name, store_id,
      updated_on, created_on, type, category, receiving_account,
      subcategory, status, transaction_id, linked_transaction_id,
      partner_transaction_id_1, partner_transaction_id_2,
      long_order_id, short_order_id, booking_id,
      order_channel, order_type, payment_method, terminal_id,
      channel, offer_type,
      grab_fee_percent, points_multiplier, points_issued,
      settlement_id, transfer_date,
      amount, tax_on_order_value, packaging_charge,
      non_member_fee, service_charge, offer,
      discount_merchant, delivery_fee_discount,
      delivery_charge_gos, delivery_charge_merchant,
      grabexpress_fee, net_sales, net_mdr,
      tax_on_mdr, grab_fee, marketing_success_fee,
      delivery_commission, channel_commission,
      order_commission, grabfood_other_commission,
      grabkitchen_commission, grabkitchen_other_commission,
      withholding_tax, total,
      cancellation_reason, cancelled_by,
      reason_for_refund, description,
      incident_group, incident_alias,
      customer_refund_item, appeal_link, appeal_status
    )
    VALUES (
      @merchant_name, @merchant_id, @store_name, @store_id,
      @updated_on, @created_on, @type, @category, @receiving_account,
      @subcategory, @status, @transaction_id, @linked_transaction_id,
      @partner_transaction_id_1, @partner_transaction_id_2,
      @long_order_id, @short_order_id, @booking_id,
      @order_channel, @order_type, @payment_method, @terminal_id,
      @channel, @offer_type,
      @grab_fee_percent, @points_multiplier, @points_issued,
      @settlement_id, @transfer_date,
      @amount, @tax_on_order_value, @packaging_charge,
      @non_member_fee, @service_charge, @offer,
      @discount_merchant, @delivery_fee_discount,
      @delivery_charge_gos, @delivery_charge_merchant,
      @grabexpress_fee, @net_sales, @net_mdr,
      @tax_on_mdr, @grab_fee, @marketing_success_fee,
      @delivery_commission, @channel_commission,
      @order_commission, @grabfood_other_commission,
      @grabkitchen_commission, @grabkitchen_other_commission,
      @withholding_tax, @total,
      @cancellation_reason, @cancelled_by,
      @reason_for_refund, @description,
      @incident_group, @incident_alias,
      @customer_refund_item, @appeal_link, @appeal_status
    )
    ON CONFLICT(booking_id) DO UPDATE SET
      updated_on = excluded.updated_on,
      total = excluded.total
  `)

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets['Transactions']
  if (!sheet) throw new Error('Transactions sheet not found')

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet)

  const transaction = db.transaction((rows: any[]) => {
    for (const row of rows) {
      if (!row['Booking ID']) continue
      insertStmt.run(mapRow(row))
    }
  })

  transaction(rows)
  
  const totalInserted = rows.length

  console.log(`[Grab Manual Import] Total inserted: ${totalInserted}`)

  return {
    inserted: totalInserted
  }
}
