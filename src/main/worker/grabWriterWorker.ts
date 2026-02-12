import { parentPort, workerData } from 'worker_threads'
import Database from 'better-sqlite3'

const { dbPath } = workerData as { dbPath: string }
const db = new Database(dbPath)

// WAL and performance settings
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = OFF;
  PRAGMA cache_size = -100000;
  PRAGMA temp_store = MEMORY;
`)

// Prepared statement with ON CONFLICT updating all columns
const grabInsertStmt = db.prepare(`
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
  merchant_name = excluded.merchant_name,
  merchant_id = excluded.merchant_id,
  store_name = excluded.store_name,
  store_id = excluded.store_id,
  updated_on = excluded.updated_on,
  created_on = excluded.created_on,
  type = excluded.type,
  category = excluded.category,
  receiving_account = excluded.receiving_account,
  subcategory = excluded.subcategory,
  status = excluded.status,
  transaction_id = excluded.transaction_id,
  linked_transaction_id = excluded.linked_transaction_id,
  partner_transaction_id_1 = excluded.partner_transaction_id_1,
  partner_transaction_id_2 = excluded.partner_transaction_id_2,
  long_order_id = excluded.long_order_id,
  short_order_id = excluded.short_order_id,
  order_channel = excluded.order_channel,
  order_type = excluded.order_type,
  payment_method = excluded.payment_method,
  terminal_id = excluded.terminal_id,
  channel = excluded.channel,
  offer_type = excluded.offer_type,
  grab_fee_percent = excluded.grab_fee_percent,
  points_multiplier = excluded.points_multiplier,
  points_issued = excluded.points_issued,
  settlement_id = excluded.settlement_id,
  transfer_date = excluded.transfer_date,
  amount = excluded.amount,
  tax_on_order_value = excluded.tax_on_order_value,
  packaging_charge = excluded.packaging_charge,
  non_member_fee = excluded.non_member_fee,
  service_charge = excluded.service_charge,
  offer = excluded.offer,
  discount_merchant = excluded.discount_merchant,
  delivery_fee_discount = excluded.delivery_fee_discount,
  delivery_charge_gos = excluded.delivery_charge_gos,
  delivery_charge_merchant = excluded.delivery_charge_merchant,
  grabexpress_fee = excluded.grabexpress_fee,
  net_sales = excluded.net_sales,
  net_mdr = excluded.net_mdr,
  tax_on_mdr = excluded.tax_on_mdr,
  grab_fee = excluded.grab_fee,
  marketing_success_fee = excluded.marketing_success_fee,
  delivery_commission = excluded.delivery_commission,
  channel_commission = excluded.channel_commission,
  order_commission = excluded.order_commission,
  grabfood_other_commission = excluded.grabfood_other_commission,
  grabkitchen_commission = excluded.grabkitchen_commission,
  grabkitchen_other_commission = excluded.grabkitchen_other_commission,
  withholding_tax = excluded.withholding_tax,
  total = excluded.total,
  cancellation_reason = excluded.cancellation_reason,
  cancelled_by = excluded.cancelled_by,
  reason_for_refund = excluded.reason_for_refund,
  description = excluded.description,
  incident_group = excluded.incident_group,
  incident_alias = excluded.incident_alias,
  customer_refund_item = excluded.customer_refund_item,
  appeal_link = excluded.appeal_link,
  appeal_status = excluded.appeal_status
`)

let totalInserted = 0

parentPort?.on('message', (msg: { batch?: any[], done?: boolean }) => {
  if (msg.batch && msg.batch.length) {
    try {
      const transaction = db.transaction((rows: any[]) => {
        for (const row of rows) grabInsertStmt.run(row)
      })
      transaction(msg.batch)

      totalInserted += msg.batch.length
      console.log(`[Grab Writer] Inserted batch of ${msg.batch.length}, total: ${totalInserted}`)
    } catch (err: any) {
      console.error('[Grab Writer] Error inserting batch:', err)
      parentPort?.postMessage({ error: err.message })
    }
  }

  if (msg.done) {
    console.log(`[Grab Writer] All done. Total inserted: ${totalInserted}`)
    parentPort?.postMessage({ totalInserted })
  }
})
