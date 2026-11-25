// Admin dashboard API (Fastify plugin). All routes are under /api/admin and need a staff session;
// each declares the permission it needs (see PERMS in auth.js). Every change is written to audit_log.
// Money is in paise.
import QRCode from 'qrcode';
import { z } from 'zod';
import { createAdminAuth, ROLES, permsOf } from './auth.js';
import { hashPassword, verifyPassword, tempPassword, checkPasswordStrength, newTotpSecret, totpUri, verifyTotp } from './crypto.js';
import { loadSettings } from '../shop/pricing.js';
import reportRoutes, { STAGES } from './reports.js';
import catalogRoutes from './catalog.js';
import returnRoutes from './returns.js';
import analyticsRoutes from './analytics.js';
import customerRoutes from './customers.js';
import complianceRoutes from './compliance.js';
import { restoreStock } from '../shop/batches.js';

const PAGE = 25;

// which status an order may move to next
export const FLOW = {
  pending_payment: ['cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'confirmed', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'rto'],
  out_for_delivery: ['delivered', 'rto'],
  delivered: ['returned'],
  rto: [], returned: [], cancelled: [], refunded: [],
};

function parse(schema, data, reply) {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  reply.code(400).send({ error: r.error.issues[0]?.message || 'Invalid request.', code: 'invalid' });
  return null;
}
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const pageOf = (q) => Math.max(1, Math.min(10000, Number.parseInt(q?.page, 10) || 1));
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;
const staffOut = (s) => ({ id: s.id, email: s.email, name: s.name, role: s.role, mustChangePassword: s.must_change_password,
  totpEnabled: s.totp_enabled, permissions: permsOf(s.role) });

export default async function adminRoutes(app, { db, razorpay, twilio, notifier, auth: authInfo, log, env }) {
  const auth = createAdminAuth({ db, env });
  const G = (perm, opts) => ({ preHandler: auth.guard(perm, opts) });
  const tight = (max) => ({ config: { rateLimit: { max, timeWindow: '15 minutes' } } });

  const audit = (q, req, action, entity, entityId, before, after) => q(
    `INSERT INTO audit_log (staff_id, staff_email, action, entity, entity_id, before, after, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.staff?.id ?? null, req.staff?.email ?? null, action, entity, entityId == null ? null : String(entityId),
      before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), req.ip]);

  // ======================================================================
  // Sign-in and own account
  // ======================================================================
  app.post('/api/admin/auth/login', tight(20), async (req, reply) => {
    const body = parse(z.object({
      email: z.string().trim().toLowerCase().email('Enter your email.').max(120),
      password: z.string().min(1, 'Enter your password.').max(128),
      code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.').optional(),
    }), req.body, reply); if (!body) return;
    const r = await auth.login(body, req);
    if (r.needsCode) return { needsCode: true };
    await auth.startSession(reply, r.staff.id, req);
    req.staff = r.staff;
    await audit(db.query, req, 'staff.login', 'staff', r.staff.id, null, null);
    return { staff: staffOut(r.staff) };
  });

  app.post('/api/admin/auth/logout', async (req, reply) => { await auth.endSession(req, reply); return { ok: true }; });

  app.get('/api/admin/auth/me', G(null, { setup: true }), async (req) => ({ staff: staffOut(req.staff) }));

  app.post('/api/admin/auth/password', { ...G(null, { setup: true }), ...tight(10) }, async (req, reply) => {
    const body = parse(z.object({ current: z.string().max(128), next: z.string().max(128) }), req.body, reply); if (!body) return;
    const s = (await db.query('SELECT password_hash FROM staff_users WHERE id = $1', [req.staff.id])).rows[0];
    if (!(await verifyPassword(body.current, s.password_hash))) throw fail('Your current password is not right.');
    const weak = checkPasswordStrength(body.next); if (weak) throw fail(weak);
    if (body.current === body.next) throw fail('Choose a password different from the current one.');
    await db.query('UPDATE staff_users SET password_hash = $2, must_change_password = false WHERE id = $1', [req.staff.id, await hashPassword(body.next)]);
    await auth.endAllSessions(req.staff.id, req.cookies.tl_admin);     // sign out other devices
    await audit(db.query, req, 'staff.password_change', 'staff', req.staff.id, null, null);
    return { ok: true };
  });

  // 2FA: create a secret (shown as a QR code), then confirm with a code from the app
  app.post('/api/admin/auth/2fa/setup', G(null, { setup: true }), async (req) => {
    if (req.staff.totp_enabled) throw fail('Two-step verification is already on.');
    const secret = newTotpSecret();
    await db.query('UPDATE staff_users SET totp_secret = $2 WHERE id = $1', [req.staff.id, secret]);
    const uri = totpUri(secret, req.staff.email);
    return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  });

  app.post('/api/admin/auth/2fa/enable', { ...G(null, { setup: true }), ...tight(10) }, async (req, reply) => {
    const body = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') }), req.body, reply); if (!body) return;
    const s = (await db.query('SELECT totp_secret, totp_enabled FROM staff_users WHERE id = $1', [req.staff.id])).rows[0];
    if (s.totp_enabled) throw fail('Two-step verification is already on.');
    if (!s.totp_secret) throw fail('Start the setup again.');
    const step = verifyTotp(s.totp_secret, body.code);
    if (step == null) throw fail('That code is not right. Check the time on your phone and try again.');
    await db.query('UPDATE staff_users SET totp_enabled = true, totp_last_step = $2 WHERE id = $1', [req.staff.id, step]);
    await audit(db.query, req, 'staff.2fa_enabled', 'staff', req.staff.id, null, null);
    return { ok: true };
  });

  // ======================================================================
  // Dashboard
  // ======================================================================
  const COUNTED = `status NOT IN ('pending_payment', 'cancelled')`;
  app.get('/api/admin/dashboard', G('view'), async () => {
    const periods = (await db.query(`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'), 0)::bigint AS today_revenue,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS today_orders,
        COALESCE(SUM(total) FILTER (WHERE created_at >= now() - interval '7 days'), 0)::bigint AS week_revenue,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS week_orders,
        COALESCE(SUM(total) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::bigint AS month_revenue,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS month_orders
      FROM orders WHERE ${COUNTED}`)).rows[0];
    const work = (await db.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'confirmed') AS to_pack,
             COUNT(*) FILTER (WHERE status = 'packed') AS to_ship,
             COUNT(*) FILTER (WHERE status IN ('shipped', 'out_for_delivery')) AS in_transit,
             COUNT(*) FILTER (WHERE status = 'pending_payment') AS awaiting_payment
      FROM orders`)).rows[0];
    const daily = (await db.query(`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(o.total), 0)::bigint AS revenue, COUNT(o.id) AS orders
        FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 13, (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') d
        LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = d::date AND o.${COUNTED}
       GROUP BY d ORDER BY d`)).rows;
    const lowStock = (await db.query(`
      SELECT p.id, p.name, i.on_hand, i.reserved, i.on_hand - i.reserved AS available, i.low_stock_at
        FROM inventory i JOIN products p ON p.id = i.product_id
       WHERE p.active AND i.on_hand - i.reserved <= i.low_stock_at ORDER BY available`)).rows;
    const recent = (await db.query(`
      SELECT o.order_number, o.status, o.payment_method, o.total, o.created_at, c.name AS customer
        FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC LIMIT 8`)).rows;
    const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));
    return { periods: num(periods), work: num(work), daily: daily.map((d) => ({ day: d.day, revenue: Number(d.revenue), orders: Number(d.orders) })), lowStock, recent };
  });

  // ======================================================================
  // Orders
  // ======================================================================
  function orderFilters(q) {
    const where = [], params = [];
    if (q.stage && STAGES[q.stage]) { params.push(STAGES[q.stage]); where.push(`o.status = ANY($${params.length})`); }
    else if (q.status && q.status !== 'all') { params.push(q.status); where.push(`o.status = $${params.length}`); }
    if (q.payment && q.payment !== 'all') { params.push(q.payment); where.push(`o.payment_method = $${params.length}`); }
    if (q.from) { params.push(q.from); where.push(`o.created_at >= $${params.length}::date`); }
    if (q.to) { params.push(q.to); where.push(`o.created_at < $${params.length}::date + 1`); }
    if (q.q) {
      params.push(like(String(q.q).trim().slice(0, 80)));
      const p = `$${params.length}`;
      where.push(`(o.order_number ILIKE ${p} OR c.name ILIKE ${p} OR c.phone ILIKE ${p} OR o.phone ILIKE ${p} OR c.email ILIKE ${p})`);
    }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  app.get('/api/admin/orders', G('view'), async (req) => {
    const page = pageOf(req.query);
    const f = orderFilters(req.query);
    const total = Number((await db.query(`SELECT COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id ${f.sql}`, f.params)).rows[0].n);
    const rows = (await db.query(`
      SELECT o.order_number, o.status, o.payment_status, o.payment_method, o.total, o.created_at,
             c.name AS customer, c.phone, o.ship_address->>'city' AS city, o.ship_address->>'state' AS state,
             (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id) AS items,
             (SELECT string_agg(i.name, ', ') FROM order_items i WHERE i.order_id = o.id) AS products
        FROM orders o JOIN customers c ON c.id = o.customer_id ${f.sql}
       ORDER BY o.created_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, f.params)).rows;
    return { rows: rows.map((r) => ({ ...r, items: Number(r.items) })), total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
  });

  // CSV export of the filtered list (max 5000 rows)
  app.get('/api/admin/orders.csv', G('view'), async (req, reply) => {
    const f = orderFilters(req.query);
    const rows = (await db.query(`
      SELECT o.order_number, o.created_at, o.status, o.payment_method, o.payment_status, c.name, c.phone, o.email,
             o.ship_address, o.subtotal, o.discount, o.shipping, o.total,
             (SELECT string_agg(i.qty || ' x ' || i.name || CASE WHEN i.pack > 1 THEN ' (pack of ' || i.pack || ')' ELSE '' END, '; ') FROM order_items i WHERE i.order_id = o.id) AS items
        FROM orders o JOIN customers c ON c.id = o.customer_id ${f.sql} ORDER BY o.created_at DESC LIMIT 5000`, f.params)).rows;
    // quote every cell; neutralise spreadsheet formulas (=, +, -, @) in customer-entered text
    const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const rs = (p) => (Number(p) / 100).toFixed(2);
    const lines = [['Order', 'Date', 'Status', 'Payment', 'Payment status', 'Customer', 'Phone', 'Email', 'Address', 'PIN', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total'].map(cell).join(',')];
    for (const r of rows) {
      const a = typeof r.ship_address === 'string' ? JSON.parse(r.ship_address) : r.ship_address;
      lines.push([r.order_number, new Date(r.created_at).toISOString(), r.status, r.payment_method, r.payment_status, r.name, r.phone, r.email,
        [a.name, a.line1, a.line2, a.city, a.state].filter(Boolean).join(', '), a.pin, r.items, rs(r.subtotal), rs(r.discount), rs(r.shipping), rs(r.total)].map(cell).join(','));
    }
    await audit(db.query, req, 'orders.export', 'order', null, null, { rows: rows.length, filters: req.query });
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="tranzlife-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    return '﻿' + lines.join('\r\n');
  });

  async function loadOrder(q, number, lock = false) {
    return (await q(`SELECT * FROM orders WHERE order_number = $1${lock ? ' FOR UPDATE' : ''}`, [String(number).slice(0, 20)])).rows[0];
  }

  app.get('/api/admin/orders/:number', G('view'), async (req, reply) => {
    const o = await loadOrder(db.query, req.params.number);
    if (!o) return reply.code(404).send({ error: 'Order not found.' });
    const [items, events, payments, refunds, customer, notifications] = await Promise.all([
      db.query('SELECT product_id, name, size, pack, qty, unit_price, unit_mrp, line_total FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]),
      db.query('SELECT from_status, to_status, note, actor, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at, id', [o.id]),
      db.query('SELECT provider_order_id, provider_payment_id, amount, method, status, error, created_at FROM payments WHERE order_id = $1 ORDER BY created_at', [o.id]),
      db.query(`SELECT r.amount, r.reason, r.method, r.status, r.provider_refund_id, r.created_at, s.email AS staff
                  FROM refunds r LEFT JOIN staff_users s ON s.id = r.staff_id WHERE r.order_id = $1 ORDER BY r.created_at`, [o.id]),
      db.query(`SELECT c.id, c.name, c.phone, c.email, c.created_at, (SELECT COUNT(*) FROM orders x WHERE x.customer_id = c.id) AS orders
                  FROM customers c WHERE c.id = $1`, [o.customer_id]),
      db.query('SELECT event, channel, status, error, created_at, sent_at FROM notifications WHERE order_id = $1 ORDER BY created_at', [o.id]),
    ]);
    const refunded = refunds.rows.filter((r) => r.status !== 'failed').reduce((s, r) => s + r.amount, 0);
    return {
      order: {
        number: o.order_number, status: o.status, paymentStatus: o.payment_status, paymentMethod: o.payment_method,
        createdAt: o.created_at, email: o.email, phone: o.phone, cancelReason: o.cancel_reason, staffNote: o.staff_note,
        address: typeof o.ship_address === 'string' ? JSON.parse(o.ship_address) : o.ship_address,
        subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, tax: o.tax, total: o.total, refunded,
        next: FLOW[o.status] || [],
      },
      items: items.rows, events: events.rows, payments: payments.rows, refunds: refunds.rows, notifications: notifications.rows,
      customer: customer.rows[0] && { ...customer.rows[0], orders: Number(customer.rows[0].orders) },
    };
  });

  async function returnStock(t, order, reason) {
    if (order.stock_committed) {
      await restoreStock(t, order, reason);          // back into the same batches (expired ones are not resold)
    } else {
      const units = (await t.query('SELECT product_id, SUM(pack * qty)::int AS units FROM order_items WHERE order_id = $1 GROUP BY product_id', [order.id])).rows;
      for (const { product_id, units: n } of units) {
        await t.query('UPDATE inventory SET reserved = GREATEST(reserved - $2, 0) WHERE product_id = $1', [product_id, n]);
      }
    }
    await t.query('UPDATE orders SET stock_committed = false WHERE id = $1', [order.id]);
  }

  const statusBody = z.object({
    status: z.enum(Object.keys(FLOW)),
    note: z.string().trim().max(500).optional().default(''),
    restock: z.boolean().optional().default(true),
  });

  /** Moves one order to a new status (same rules for single and bulk changes). Notifies the customer. */
  async function changeStatus(req, number, body) {
    const result = await db.tx(async (t) => {
      const o = await loadOrder(t.query, number, true);
      if (!o) throw fail('Order not found.', 404);
      if (!(FLOW[o.status] || []).includes(body.status)) throw fail(`An order that is "${o.status}" cannot be moved to "${body.status}".`, 409);
      if (body.status === 'cancelled' && !body.note) throw fail('Give a reason for cancelling.');
      const sets = ['status = $2', 'updated_at = now()'];
      const params = [o.id, body.status];
      if (body.status === 'cancelled') {
        await returnStock(t, o, 'cancel');
        params.push(body.note); sets.push(`cancel_reason = $${params.length}`);
        if (o.payment_status === 'pending') sets.push(`payment_status = 'expired'`);
      }
      if ((body.status === 'rto' || body.status === 'returned') && body.restock) await returnStock(t, o, 'return');
      // cash collected on delivery
      if (body.status === 'delivered' && o.payment_method === 'cod' && o.payment_status === 'cod_pending') sets.push(`payment_status = 'paid'`);
      await t.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $1`, params);
      await t.query('INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,$2,$3,$4,$5)',
        [o.id, o.status, body.status, body.note || null, `staff:${req.staff.email}`]);
      await audit(t.query, req, 'order.status', 'order', o.order_number, { status: o.status }, { status: body.status, note: body.note || undefined });
      return { id: o.id, from: o.status, paid: o.payment_status === 'paid' && o.payment_method !== 'cod' };
    });
    notifier?.notify(result.id, body.status, body.status === 'shipped' ? body.note : undefined);
    return { refundSuggested: body.status === 'cancelled' && result.paid };
  }

  app.post('/api/admin/orders/:number/status', G('orders.edit'), async (req, reply) => {
    const body = parse(statusBody, req.body, reply); if (!body) return;
    return { ok: true, ...(await changeStatus(req, req.params.number, body)) };
  });

  // Bulk: move several orders at once. Each order is its own transaction; one failure doesn't stop the rest.
  app.post('/api/admin/orders/bulk-status', G('orders.edit'), async (req, reply) => {
    const body = parse(statusBody.extend({ numbers: z.array(z.string().max(20)).min(1).max(100) }), req.body, reply); if (!body) return;
    const results = [];
    for (const number of [...new Set(body.numbers)]) {
      try { results.push({ number, ok: true, ...(await changeStatus(req, number, body)) }); }
      catch (e) { results.push({ number, ok: false, error: e.status && e.status < 500 ? e.message : 'Something went wrong.' }); }
    }
    return { results, done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  });

  app.post('/api/admin/orders/:number/note', G('orders.note'), async (req, reply) => {
    const body = parse(z.object({ note: z.string().trim().max(2000) }), req.body, reply); if (!body) return;
    const o = await loadOrder(db.query, req.params.number);
    if (!o) return reply.code(404).send({ error: 'Order not found.' });
    await db.query('UPDATE orders SET staff_note = $2 WHERE id = $1', [o.id, body.note || null]);
    await audit(db.query, req, 'order.note', 'order', o.order_number, { note: o.staff_note }, { note: body.note });
    return { ok: true };
  });

  // Refund: through Razorpay for online payments; recorded as a manual refund for COD (paid back by hand).
  /** Refunds (part of) a paid order: Razorpay for online payments, a manual record for COD. */
  async function issueRefund(req, number, { amount: wanted, reason }) {
    const o = await loadOrder(db.query, number);
    if (!o) throw fail('Order not found.', 404);
    if (!['paid', 'partially_refunded'].includes(o.payment_status)) throw fail('Only paid orders can be refunded.', 409);
    const done = Number((await db.query(`SELECT COALESCE(SUM(amount), 0) AS n FROM refunds WHERE order_id = $1 AND status <> 'failed'`, [o.id])).rows[0].n);
    const left = o.total - done;
    const amount = wanted ?? left;
    if (amount <= 0 || amount > left) throw fail(`At most ₹${(left / 100).toFixed(2)} can still be refunded.`);

    let method = 'manual', providerRefundId = null, status = 'processed', paymentId = null, raw = null;
    if (o.payment_method !== 'cod') {
      const pay = (await db.query(`SELECT id, provider_payment_id FROM payments WHERE order_id = $1 AND status = 'paid' ORDER BY created_at DESC LIMIT 1`, [o.id])).rows[0];
      if (!pay?.provider_payment_id) throw fail('No captured Razorpay payment found for this order.', 409);
      const r = await razorpay.refund(pay.provider_payment_id, { amount, notes: { order_number: o.order_number, reason: reason.slice(0, 200) } });
      method = 'razorpay'; providerRefundId = r.id; status = r.status === 'processed' ? 'processed' : 'pending'; paymentId = pay.id; raw = r;
    }
    await db.tx(async (t) => {
      await t.query(
        `INSERT INTO refunds (order_id, payment_id, amount, reason, method, provider_refund_id, status, staff_id, raw) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [o.id, paymentId, amount, reason, method, providerRefundId, status, req.staff.id, raw ? JSON.stringify(raw) : null]);
      const full = done + amount >= o.total;
      await t.query(`UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1`, [o.id, full ? 'refunded' : 'partially_refunded']);
      await t.query('INSERT INTO order_events (order_id, from_status, to_status, note, actor) VALUES ($1,$2,$3,$4,$5)',
        [o.id, o.status, o.status, `Refund ₹${(amount / 100).toFixed(2)} (${method}): ${reason}`, `staff:${req.staff.email}`]);
      await audit(t.query, req, 'order.refund', 'order', o.order_number, { refunded: done }, { amount, method, reason, providerRefundId });
    });
    return { amount, method, status };
  }

  app.post('/api/admin/orders/:number/refund', { ...G('refunds'), ...tight(20) }, async (req, reply) => {
    const body = parse(z.object({
      amount: z.number().int().positive().optional(),       // paise; default = everything not yet refunded
      reason: z.string().trim().min(3, 'Give a reason for the refund.').max(300),
    }), req.body, reply); if (!body) return;
    return { ok: true, ...(await issueRefund(req, req.params.number, body)) };
  });

  // ======================================================================
  // Products and stock
  // ======================================================================
  // product list, detail, create and edit live in catalog.js

  // add (restock, or negative to write off) or set the counted stock
  app.post('/api/admin/products/:id/stock', G('stock.edit'), async (req, reply) => {
    const body = parse(z.object({
      mode: z.enum(['add', 'set']),
      units: z.number().int().min(-100000).max(100000),
      note: z.string().trim().max(300).optional().default(''),
    }), req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const i = (await t.query('SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!i) throw fail('Product not found.', 404);
      const onHand = body.mode === 'set' ? body.units : i.on_hand + body.units;
      if (onHand < 0) throw fail('Stock cannot go below zero.');
      if (onHand < i.reserved) throw fail(`${i.reserved} unit(s) are held for unpaid orders, so stock cannot go below that.`);
      const change = onHand - i.on_hand;
      if (change === 0) return { ok: true, onHand };
      await t.query('UPDATE inventory SET on_hand = $2 WHERE product_id = $1', [i.product_id, onHand]);
      await t.query('INSERT INTO stock_movements (product_id, change, reason, ref) VALUES ($1,$2,$3,$4)',
        [i.product_id, change, body.mode === 'add' && change > 0 ? 'restock' : 'adjust', body.note || `staff:${req.staff.email}`]);
      await audit(t.query, req, 'stock.adjust', 'product', i.product_id, { on_hand: i.on_hand }, { on_hand: onHand, note: body.note || undefined });
      return { ok: true, onHand };
    });
  });

  app.get('/api/admin/products/:id/stock', G('view'), async (req) => ({
    movements: (await db.query('SELECT change, reason, ref, created_at FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50', [req.params.id])).rows,
  }));

  // ======================================================================
  // Customers
  // ======================================================================
  // customer list, profile and notes live in customers.js

  // Data deletion request (India DPDP Act): remove personal details from the account. Orders stay
  // (tax records must be kept) but are no longer linked to a name, email or saved address.
  app.post('/api/admin/customers/:id/delete', G('customers.edit'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    return db.tx(async (t) => {
      const c = (await t.query('SELECT * FROM customers WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!c) throw fail('Customer not found.', 404);
      if (c.deleted_at) throw fail('This customer has already been deleted.');
      await t.query(`UPDATE customers SET name = 'Deleted customer', email = NULL, phone = 'deleted:' || id::text, marketing_consent = false, deleted_at = now() WHERE id = $1`, [id]);
      await t.query('DELETE FROM addresses WHERE customer_id = $1', [id]);
      await t.query('DELETE FROM sessions WHERE customer_id = $1', [id]);
      await audit(t.query, req, 'customer.delete', 'customer', id, { phone: c.phone.replace(/\d(?=\d{4})/g, '•') }, null);
      return { ok: true };
    });
  });

  // ======================================================================
  // Payments
  // ======================================================================
  app.get('/api/admin/payments', G('view'), async (req) => {
    const page = pageOf(req.query);
    const params = [];
    let where = '';
    if (req.query.status && req.query.status !== 'all') { params.push(req.query.status); where = 'WHERE p.status = $1'; }
    const total = Number((await db.query(`SELECT COUNT(*) AS n FROM payments p ${where}`, params)).rows[0].n);
    const rows = (await db.query(`
      SELECT p.provider_order_id, p.provider_payment_id, p.amount, p.method, p.status, p.error, p.created_at, o.order_number, c.name AS customer
        FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id ${where}
       ORDER BY p.created_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params)).rows;
    const refunds = (await db.query(`
      SELECT r.amount, r.method, r.status, r.reason, r.created_at, o.order_number FROM refunds r JOIN orders o ON o.id = r.order_id
       ORDER BY r.created_at DESC LIMIT 20`)).rows;
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), refunds, razorpay: razorpay.enabled };
  });

  // ======================================================================
  // Staff (owner only)
  // ======================================================================
  app.get('/api/admin/staff', G('staff'), async () => ({
    staff: (await db.query(`SELECT id, email, name, role, active, totp_enabled, must_change_password, last_login_at, created_at,
                              (locked_until > now()) AS locked FROM staff_users ORDER BY created_at`)).rows,
  }));

  app.post('/api/admin/staff', G('staff'), async (req, reply) => {
    const body = parse(z.object({
      email: z.string().trim().toLowerCase().email('Enter a valid email.').max(120),
      name: z.string().trim().min(2, 'Enter their name.').max(80),
      role: z.enum(ROLES),
    }), req.body, reply); if (!body) return;
    const temp = tempPassword();
    try {
      const s = (await db.query(`INSERT INTO staff_users (email, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id`,
        [body.email, body.name, body.role, await hashPassword(temp)])).rows[0];
      await audit(db.query, req, 'staff.create', 'staff', s.id, null, { email: body.email, role: body.role });
      return { ok: true, id: s.id, tempPassword: temp };
    } catch (e) {
      if (e.code === '23505') throw fail('A staff account with this email already exists.', 409);
      throw e;
    }
  });

  async function activeOwners(q, exceptId) {
    return Number((await q(`SELECT COUNT(*) AS n FROM staff_users WHERE role = 'owner' AND active AND id <> $1`, [exceptId])).rows[0].n);
  }

  app.patch('/api/admin/staff/:id', G('staff'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({ role: z.enum(ROLES).optional(), active: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional() }), req.body, reply); if (!body) return;
    return db.tx(async (t) => {
      const s = (await t.query('SELECT * FROM staff_users WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!s) throw fail('Staff member not found.', 404);
      const losingOwner = s.role === 'owner' && s.active && ((body.role && body.role !== 'owner') || body.active === false);
      if (losingOwner && (await activeOwners(t.query, id)) === 0) throw fail('There must always be at least one active owner.');
      await t.query('UPDATE staff_users SET role = $2, active = $3, name = $4 WHERE id = $1', [id, body.role ?? s.role, body.active ?? s.active, body.name ?? s.name]);
      if (body.active === false) await t.query('DELETE FROM staff_sessions WHERE staff_id = $1', [id]);
      await audit(t.query, req, 'staff.update', 'staff', id, { role: s.role, active: s.active, name: s.name }, { role: body.role ?? s.role, active: body.active ?? s.active, name: body.name ?? s.name });
      return { ok: true };
    });
  });

  app.post('/api/admin/staff/:id/reset-password', G('staff'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const temp = tempPassword();
    const r = await db.query(`UPDATE staff_users SET password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = NULL WHERE id = $1`, [id, await hashPassword(temp)]);
    if (!(r.affectedRows ?? r.rowCount)) throw fail('Staff member not found.', 404);
    await auth.endAllSessions(id);
    await audit(db.query, req, 'staff.reset_password', 'staff', id, null, null);
    return { ok: true, tempPassword: temp };
  });

  app.post('/api/admin/staff/:id/reset-2fa', G('staff'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const r = await db.query(`UPDATE staff_users SET totp_enabled = false, totp_secret = NULL, totp_last_step = NULL WHERE id = $1`, [id]);
    if (!(r.affectedRows ?? r.rowCount)) throw fail('Staff member not found.', 404);
    await auth.endAllSessions(id);
    await audit(db.query, req, 'staff.reset_2fa', 'staff', id, null, null);
    return { ok: true };
  });

  // ======================================================================
  // Shop settings (owner only)
  // ======================================================================
  app.get('/api/admin/settings', G('view'), async () => ({ settings: await loadSettings(db.query) }));

  app.patch('/api/admin/settings', G('settings'), async (req, reply) => {
    const body = parse(z.object({
      free_shipping_above: z.number().int().min(0).max(10_000_000).optional(),   // paise
      shipping_fee: z.number().int().min(0).max(1_000_000).optional(),           // paise
      prepaid_discount_pct: z.number().min(0).max(50).optional(),
    }), req.body, reply); if (!body) return;
    const before = await loadSettings(db.query);
    for (const [k, v] of Object.entries(body)) await db.query('UPDATE settings SET value = $2 WHERE key = $1', [k, JSON.stringify(v)]);
    await audit(db.query, req, 'settings.update', 'settings', null, Object.fromEntries(Object.keys(body).map((k) => [k, before[k]])), body);
    return { settings: await loadSettings(db.query) };
  });

  // ======================================================================
  // Connected services: is Twilio / Razorpay set up and working (credentials checked live)
  // ======================================================================
  app.get('/api/admin/integrations', G('view'), async () => ({
    twilio: await twilio.status(),
    signInCodes: authInfo.mode,
    orderMessages: notifier.channel,
    razorpay: razorpay.enabled,
  }));

  // ======================================================================
  // Activity log
  // ======================================================================
  app.get('/api/admin/audit', G('view'), async (req) => {
    const page = pageOf(req.query);
    const params = [], where = [];
    if (req.query.entity) { params.push(String(req.query.entity)); where.push(`entity = $${params.length}`); }
    if (req.query.entityId) { params.push(String(req.query.entityId)); where.push(`entity_id = $${params.length}`); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number((await db.query(`SELECT COUNT(*) AS n FROM audit_log ${w}`, params)).rows[0].n);
    const rows = (await db.query(`SELECT staff_email, action, entity, entity_id, before, after, ip, created_at FROM audit_log ${w}
                                   ORDER BY created_at DESC, id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params)).rows;
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
  });

  await reportRoutes(app, { db, G, parse, env });
  await catalogRoutes(app, { db, G, parse, audit, env, log });
  await returnRoutes(app, { db, G, parse, audit, issueRefund, loadOrder });
  await analyticsRoutes(app, { db, G });
  await customerRoutes(app, { db, G, parse, audit });
  await complianceRoutes(app, { db, G, parse, audit, env, log });

  app.setErrorHandler((err, req, reply) => {
    if (err.status && err.status < 500) return reply.code(err.status).send({ error: err.message, code: err.code || 'error' });
    if (err.statusCode === 429) return reply.code(429).send({ error: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'Invalid request.', code: 'invalid' });
    if (err.status === 502) return reply.code(502).send({ error: err.message, code: 'provider_error' });
    if (err.status === 503) return reply.code(503).send({ error: err.message, code: 'unavailable' });
    log.error({ err, url: req.url }, '[admin] request failed');
    return reply.code(500).send({ error: 'Something went wrong on our side. Please try again.', code: 'server_error' });
  });

}
