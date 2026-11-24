// Production batches: first-expiry-first-out (FEFO) allocation, putting stock back on returns, and
// taking expired batches out of stock.
//
//   inventory.on_hand  = everything physically in stock (batched + any older stock with no batch)
//   batches.qty_remaining = the part of on_hand that belongs to that batch
// Units sold come from the batch that expires soonest (and has not expired); anything not covered by
// a batch comes from the un-batched stock. Each allocation is recorded in order_item_batches so you
// can see which customers received which batch (recalls).

/** Today's date in India (batches expire at the start of their expiry date). */
export const TODAY_IST = `(now() AT TIME ZONE 'Asia/Kolkata')::date`;

/** Allocates every item of an order to batches, soonest expiry first. Call inside the transaction that commits the stock. */
export async function allocateFefo(t, orderId) {
  const items = (await t.query('SELECT id, product_id, pack * qty AS units FROM order_items WHERE order_id = $1 ORDER BY id', [orderId])).rows;
  for (const item of items) {
    let need = Number(item.units);
    const batches = (await t.query(
      `SELECT id, qty_remaining FROM batches
        WHERE product_id = $1 AND qty_remaining > 0 AND written_off_at IS NULL AND expiry_date > ${TODAY_IST}
        ORDER BY expiry_date, created_at FOR UPDATE`, [item.product_id])).rows;
    for (const b of batches) {
      if (need <= 0) break;
      const take = Math.min(need, b.qty_remaining);
      await t.query('UPDATE batches SET qty_remaining = qty_remaining - $2 WHERE id = $1', [b.id, take]);
      await t.query(
        `INSERT INTO order_item_batches (order_item_id, batch_id, qty) VALUES ($1,$2,$3)
         ON CONFLICT (order_item_id, batch_id) DO UPDATE SET qty = order_item_batches.qty + EXCLUDED.qty`, [item.id, b.id, take]);
      need -= take;
    }
    // need > 0 here means the rest came from older stock that has no batch
  }
}

/**
 * Puts a committed order's units back in stock (cancel / return / RTO). Units from a batch that has
 * expired or been written off are NOT put back on sale. Returns how many units went back.
 */
export async function restoreStock(t, order, reason) {
  const items = (await t.query('SELECT id, product_id, pack * qty AS units FROM order_items WHERE order_id = $1', [order.id])).rows;
  let restored = 0;
  for (const item of items) {
    const allocs = (await t.query(
      `SELECT a.batch_id, a.qty, (b.written_off_at IS NOT NULL OR b.expiry_date <= ${TODAY_IST}) AS dead
         FROM order_item_batches a JOIN batches b ON b.id = a.batch_id WHERE a.order_item_id = $1`, [item.id])).rows;
    let back = Number(item.units);
    for (const a of allocs) {
      if (a.dead) { back -= a.qty; continue; }
      await t.query('UPDATE batches SET qty_remaining = qty_remaining + $2 WHERE id = $1', [a.batch_id, a.qty]);
    }
    await t.query('DELETE FROM order_item_batches WHERE order_item_id = $1', [item.id]);
    if (back > 0) {
      await t.query('UPDATE inventory SET on_hand = on_hand + $2 WHERE product_id = $1', [item.product_id, back]);
      await t.query('INSERT INTO stock_movements (product_id, change, reason, ref) VALUES ($1,$2,$3,$4)', [item.product_id, back, reason, order.order_number]);
      restored += back;
    }
  }
  return restored;
}

/** Takes batches that reached their expiry date out of stock. Safe to run often. Returns the batches written off. */
export async function writeOffExpired(db, log) {
  const due = (await db.query(
    `SELECT id FROM batches WHERE written_off_at IS NULL AND qty_remaining > 0 AND expiry_date <= ${TODAY_IST}`)).rows;
  const done = [];
  for (const { id } of due) {
    await db.tx(async (t) => {
      const b = (await t.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!b || b.written_off_at || b.qty_remaining <= 0) return;
      const inv = (await t.query('SELECT on_hand, reserved FROM inventory WHERE product_id = $1 FOR UPDATE', [b.product_id])).rows[0];
      // never take away units already held for unpaid orders
      const take = Math.max(0, Math.min(b.qty_remaining, inv.on_hand - inv.reserved));
      if (take > 0) {
        await t.query('UPDATE inventory SET on_hand = on_hand - $2 WHERE product_id = $1', [b.product_id, take]);
        await t.query(`INSERT INTO stock_movements (product_id, change, reason, ref) VALUES ($1,$2,'expired',$3)`, [b.product_id, -take, `batch ${b.batch_no}`]);
      }
      await t.query('UPDATE batches SET qty_remaining = 0, written_off_at = now() WHERE id = $1', [id]);
      done.push({ productId: b.product_id, batchNo: b.batch_no, units: take });
    });
  }
  if (done.length) log?.info?.(`[batches] expired and taken out of stock: ${done.map((d) => `${d.productId} ${d.batchNo} (${d.units})`).join(', ')}`);
  return done;
}
