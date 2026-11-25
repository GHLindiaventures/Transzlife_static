// Returns: requested (staff log it when a customer asks) -> received & inspected (per item:
// resellable / damaged / expired; resellable units go back on sale, into the same batch)
// -> resolved (refund / replacement / no action) or rejected. Everything is audited.
import { z } from 'zod';
import { restockItemUnits } from '../shop/batches.js';
import { can } from './auth.js';

export const RETURN_REASONS = {
  damaged: 'Arrived damaged or leaking', wrong_item: 'Wrong item sent', expired: 'Expired or near expiry',
  not_effective: 'Did not suit / no effect', allergy: 'Allergy or side effect', changed_mind: 'Changed mind', other: 'Other',
};
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export default async function returnRoutes(app, { db, G, parse, audit, issueRefund, loadOrder }) {
  // packs of each order item already in a (non-rejected) return
  const alreadyReturned = async (q, orderId) => Object.fromEntries((await q(`
    SELECT ri.order_item_id, SUM(ri.qty)::int AS qty FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.order_id = $1 AND r.status <> 'rejected' GROUP BY ri.order_item_id`, [orderId])).rows.map((r) => [r.order_item_id, r.qty]));

  app.get('/api/admin/returns/counts', G('view'), async () => {
    const r = (await db.query(`SELECT status, COUNT(*) AS n FROM returns GROUP BY status`)).rows.reduce((m, x) => ({ ...m, [x.status]: Number(x.n) }), {});
    return { counts: { open: (r.requested || 0) + (r.received || 0), requested: r.requested || 0, received: r.received || 0, resolved: r.resolved || 0, rejected: r.rejected || 0 } };
  });

  app.get('/api/admin/returns', G('view'), async (req) => {
    const status = String(req.query.status || 'open');
    const where = status === 'open' ? `r.status IN ('requested','received')` : status === 'all' ? 'TRUE' : 'r.status = $1';
    const rows = (await db.query(`
      SELECT r.id, r.return_number, r.status, r.reason, r.resolution, r.refund_amount, r.created_at, r.received_at, r.resolved_at,
             o.order_number, o.payment_method, c.id AS customer_id, c.name AS customer, c.phone,
             (SELECT SUM(ri.qty) FROM return_items ri WHERE ri.return_id = r.id)::int AS packs,
             (SELECT string_agg(i.name, ', ') FROM return_items ri JOIN order_items i ON i.id = ri.order_item_id WHERE ri.return_id = r.id) AS products
        FROM returns r JOIN orders o ON o.id = r.order_id JOIN customers c ON c.id = o.customer_id
       WHERE ${where} ORDER BY r.created_at DESC LIMIT 200`, ['open', 'all'].includes(status) ? [] : [status])).rows;
    return { rows, reasons: RETURN_REASONS };
  });

  async function loadReturn(id) {
    const r = (await db.query(`
      SELECT r.*, o.order_number, o.status AS order_status, o.payment_method, o.payment_status, o.total AS order_total,
             c.id AS customer_id, c.name AS customer, c.phone, s.email AS created_by_email
        FROM returns r JOIN orders o ON o.id = r.order_id JOIN customers c ON c.id = o.customer_id
        LEFT JOIN staff_users s ON s.id = r.created_by WHERE r.id = $1`, [id])).rows[0];
    if (!r) return null;
    const items = (await db.query(`
      SELECT ri.id, ri.order_item_id, ri.qty, ri.condition, ri.restocked, i.name, i.size, i.pack, i.unit_price
        FROM return_items ri JOIN order_items i ON i.id = ri.order_item_id WHERE ri.return_id = $1 ORDER BY ri.id`, [id])).rows;
    const refunded = Number((await db.query(`SELECT COALESCE(SUM(amount), 0) AS n FROM refunds WHERE order_id = $1 AND status <> 'failed'`, [r.order_id])).rows[0].n);
    const value = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    return { ret: r, items, suggestedRefund: Math.max(0, Math.min(value, r.order_total - refunded)), refundable: r.order_total - refunded };
  }

  app.get('/api/admin/returns/:id', G('view'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const full = await loadReturn(id);
    if (!full) return reply.code(404).send({ error: 'Return not found.' });
    return { ...full, reasons: RETURN_REASONS };
  });

  // what can still be returned on an order (for the "Start a return" form)
  app.get('/api/admin/orders/:number/returnable', G('view'), async (req, reply) => {
    const o = await loadOrder(db.query, req.params.number);
    if (!o) return reply.code(404).send({ error: 'Order not found.' });
    const done = await alreadyReturned(db.query, o.id);
    const items = (await db.query('SELECT id, name, size, pack, qty, unit_price FROM order_items WHERE order_id = $1 ORDER BY id', [o.id])).rows
      .map((i) => ({ ...i, returnable: i.qty - (done[i.id] || 0) }));
    const returns = (await db.query('SELECT id, return_number, status, created_at FROM returns WHERE order_id = $1 ORDER BY created_at', [o.id])).rows;
    return { eligible: o.status === 'delivered', items, returns, reasons: RETURN_REASONS };
  });

  app.post('/api/admin/orders/:number/returns', G('orders.edit'), async (req, reply) => {
    const body = parse(z.object({
      items: z.array(z.object({ orderItemId: z.number().int().positive(), qty: z.number().int().min(1).max(100) })).min(1, 'Choose at least one item.').max(30),
      reason: z.enum(Object.keys(RETURN_REASONS)), note: z.string().trim().max(500).optional().default(''),
    }), req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const o = await loadOrder(t.query, req.params.number, true);
      if (!o) throw fail('Order not found.', 404);
      if (o.status !== 'delivered') throw fail('Returns can be started only for delivered orders.', 409);
      const done = await alreadyReturned(t.query, o.id);
      const own = new Map((await t.query('SELECT id, qty FROM order_items WHERE order_id = $1', [o.id])).rows.map((i) => [Number(i.id), i.qty]));
      for (const it of body.items) {
        if (!own.has(it.orderItemId)) throw fail('That item is not part of this order.');
        if (it.qty > own.get(it.orderItemId) - (done[it.orderItemId] || 0)) throw fail('You are returning more than was bought (or already returned).');
      }
      const n = (await t.query(`SELECT nextval('return_number_seq') AS n`)).rows[0].n;
      const number = `RET-${String(n).padStart(6, '0')}`;
      const r = (await t.query(
        `INSERT INTO returns (return_number, order_id, status, reason, reason_note, created_by) VALUES ($1,$2,'requested',$3,$4,$5) RETURNING id`,
        [number, o.id, body.reason, body.note || null, req.staff.id])).rows[0];
      for (const it of body.items) await t.query('INSERT INTO return_items (return_id, order_item_id, qty) VALUES ($1,$2,$3)', [r.id, it.orderItemId, it.qty]);
      await t.query('INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,$2,$2,$3,$4)',
        [o.id, o.status, `Return ${number} requested: ${RETURN_REASONS[body.reason]}${body.note ? ` (${body.note})` : ''}`, `staff:${req.staff.email}`]);
      await audit(t.query, req, 'return.create', 'order', o.order_number, null, { return: number, reason: body.reason, items: body.items.length });
      return { ok: true, id: r.id, number };
    });
  });

  // items arrived: record each one's condition; resellable units go back on sale
  app.post('/api/admin/returns/:id/receive', G('orders.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({
      items: z.array(z.object({ id: z.number().int().positive(), condition: z.enum(['resellable', 'damaged', 'expired']) })).min(1),
      note: z.string().trim().max(500).optional().default(''),
    }), req.body, reply); if (!body) return;
    const result = await db.tx(async (t) => {
      const r = (await t.query('SELECT * FROM returns WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!r) throw fail('Return not found.', 404);
      if (r.status !== 'requested') throw fail('This return has already been received.', 409);
      const items = (await t.query('SELECT ri.*, i.pack FROM return_items ri JOIN order_items i ON i.id = ri.order_item_id WHERE ri.return_id = $1', [id])).rows;
      const cond = new Map(body.items.map((i) => [i.id, i.condition]));
      if (items.some((i) => !cond.has(Number(i.id)))) throw fail('Choose the condition of every item.');
      let restocked = 0;
      for (const it of items) {
        const c = cond.get(Number(it.id));
        let back = 0;
        if (c === 'resellable') back = await restockItemUnits(t, it.order_item_id, it.qty * it.pack, r.return_number);
        await t.query('UPDATE return_items SET condition = $2, restocked = $3 WHERE id = $1', [it.id, c, back]);
        restocked += back;
      }
      await t.query(`UPDATE returns SET status = 'received', received_at = now(), staff_note = NULLIF(concat_ws(E'\\n', staff_note, $2::text), '') WHERE id = $1`, [id, body.note || null]);
      // every item of the order came back -> the order itself is "returned"
      const o = (await t.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [r.order_id])).rows[0];
      const done = await alreadyReturned(t.query, o.id);
      const all = (await t.query('SELECT id, qty FROM order_items WHERE order_id = $1', [o.id])).rows.every((i) => (done[i.id] || 0) >= i.qty);
      if (all && o.status === 'delivered') {
        await t.query(`UPDATE orders SET status = 'returned', updated_at = now() WHERE id = $1`, [o.id]);
        await t.query(`INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,'delivered','returned',$2,$3)`, [o.id, `Return ${r.return_number} received`, `staff:${req.staff.email}`]);
      } else {
        await t.query('INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,$2,$2,$3,$4)', [o.id, o.status, `Return ${r.return_number} received (${restocked} unit(s) back in stock)`, `staff:${req.staff.email}`]);
      }
      await audit(t.query, req, 'return.receive', 'order', o.order_number, null, { return: r.return_number, restocked, conditions: body.items.map((i) => i.condition) });
      return { restocked, orderReturned: all };
    });
    return { ok: true, ...result };
  });

  // close the return: refund (through the normal refund rules), replacement, or no action
  app.post('/api/admin/returns/:id/resolve', G('orders.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({
      resolution: z.enum(['refund', 'replacement', 'no_action']), amount: z.number().int().positive().optional(),
      note: z.string().trim().max(500).optional().default(''),
    }), req.body, reply); if (!body) return;
    const full = await loadReturn(id);
    if (!full) return reply.code(404).send({ error: 'Return not found.' });
    const r = full.ret;
    if (r.status !== 'received') throw fail(r.status === 'requested' ? 'Mark the items as received first.' : 'This return is already closed.', 409);
    let refund = null;
    if (body.resolution === 'refund') {
      if (!can(req.staff, 'refunds')) throw fail('Your role does not allow refunds.', 403);
      refund = await issueRefund(req, r.order_number, { amount: body.amount ?? full.suggestedRefund, reason: `Return ${r.return_number}: ${RETURN_REASONS[r.reason]}` });
    }
    await db.tx(async (t) => {
      const cur = (await t.query('SELECT status FROM returns WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (cur.status !== 'received') throw fail('This return is already closed.', 409);
      await t.query(`UPDATE returns SET status = 'resolved', resolution = $2, refund_amount = $3, resolved_at = now(),
                       staff_note = NULLIF(concat_ws(E'\\n', staff_note, $4::text), '') WHERE id = $1`, [id, body.resolution, refund?.amount ?? null, body.note || null]);
      await audit(t.query, req, 'return.resolve', 'order', r.order_number, null, { return: r.return_number, resolution: body.resolution, refund: refund?.amount });
    });
    return { ok: true, refund };
  });

  app.post('/api/admin/returns/:id/reject', G('orders.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({ note: z.string().trim().min(3, 'Give a reason for rejecting.').max(500) }), req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const r = (await t.query('SELECT r.*, o.order_number FROM returns r JOIN orders o ON o.id = r.order_id WHERE r.id = $1 FOR UPDATE OF r', [id])).rows[0];
      if (!r) throw fail('Return not found.', 404);
      if (r.status !== 'requested') throw fail(r.status === 'received' ? 'Items were already received: resolve it with "no action" instead.' : 'This return is already closed.', 409);
      await t.query(`UPDATE returns SET status = 'rejected', resolved_at = now(), staff_note = $2 WHERE id = $1`, [id, body.note]);
      await audit(t.query, req, 'return.reject', 'order', r.order_number, null, { return: r.return_number, note: body.note });
      return { ok: true };
    });
  });
}
