// Order tracking lookup, courier webhook/API sync (Shiprocket, Delhivery, or manual AWB),
// and automatic delay detection when shipments pass their expected delivery date.
import { timingSafeEqual } from 'node:crypto';

export const TRACKING_STAGES = [
  { key: 'placed', label: 'Order Placed', desc: 'Your order has been received' },
  { key: 'confirmed', label: 'Order Confirmed', desc: 'Order verified and confirmed' },
  { key: 'processing', label: 'Processing / Packing', desc: 'Items are being picked & packed' },
  { key: 'packed', label: 'Packed', desc: 'Ready for courier handover' },
  { key: 'shipped', label: 'Shipped', desc: 'Handed over to delivery partner' },
  { key: 'in_transit', label: 'In Transit', desc: 'Moving through courier network' },
  { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Delivery agent is on the way' },
  { key: 'delivered', label: 'Delivered', desc: 'Successfully delivered' },
];

const STATUS_INDEX = {
  pending_payment: 0,
  confirmed: 1,
  processing: 2,
  packed: 3,
  shipped: 4,
  in_transit: 5,
  out_for_delivery: 6,
  delivered: 7,
};

// Map common courier scan statuses (Shiprocket / Delhivery / generic) -> internal statuses
const COURIER_STATUS_MAP = new Map([
  ['pickup scheduled', 'packed'],
  ['ready to ship', 'packed'],
  ['manifested', 'packed'],
  ['picked up', 'shipped'],
  ['shipped', 'shipped'],
  ['dispatched', 'shipped'],
  ['in transit', 'in_transit'],
  ['in_transit', 'in_transit'],
  ['reached destination hub', 'in_transit'],
  ['out for delivery', 'out_for_delivery'],
  ['out_for_delivery', 'out_for_delivery'],
  ['ofd', 'out_for_delivery'],
  ['delivered', 'delivered'],
  ['rto', 'rto'],
  ['rto initiated', 'rto'],
  ['rto delivered', 'rto'],
  ['undelivered', 'in_transit'],
  ['delayed', 'in_transit'],
]);

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

export function createCourier({ db, notifier, env = process.env, log }) {
  /**
   * Public tracking view by tracking_id (TRK-TZL-xxxxxx), order_number (TZL-xxxxxx), or AWB.
   * Masks full street address & phone unless `full = true` (signed-in owner).
   */
  async function getPublicTracking(queryId, { full = false } = {}) {
    const clean = String(queryId || '').trim().toUpperCase();
    if (!clean) return null;
    const o = (await db.query(
      `SELECT * FROM orders
        WHERE upper(tracking_id) = $1 OR upper(order_number) = $1 OR upper(awb_number) = $1
        LIMIT 1`,
      [clean],
    )).rows[0];
    if (!o) return null;

    const items = (await db.query('SELECT name, size, pack, qty FROM order_items WHERE order_id = $1 ORDER BY id', [o.id])).rows;
    const events = (await db.query(
      'SELECT to_status, note, location, source, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC, id ASC',
      [o.id],
    )).rows;

    const addr = typeof o.ship_address === 'string' ? JSON.parse(o.ship_address) : (o.ship_address || {});
    const currentStep = STATUS_INDEX[o.status] ?? -1;

    // Resolve timestamp for each of the 8 stages from order_events
    const stageTimes = {};
    stageTimes.placed = o.created_at;
    for (const ev of events) {
      const s = ev.to_status;
      if (s === 'pending_payment' && !stageTimes.placed) stageTimes.placed = ev.created_at;
      else if (STATUS_INDEX[s] != null && !stageTimes[s]) stageTimes[s] = ev.created_at;
    }

    const stages = TRACKING_STAGES.map((st, idx) => ({
      key: st.key,
      label: st.label,
      desc: st.desc,
      completed: currentStep >= idx,
      current: currentStep === idx,
      at: currentStep >= idx ? (stageTimes[st.key] || null) : null,
    }));

    return {
      orderNumber: o.order_number,
      trackingId: o.tracking_id || `TRK-${o.order_number}`,
      status: o.status,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      estimatedDeliveryAt: o.estimated_delivery_at,
      originalEddAt: o.original_edd_at,
      isDelayed: !!o.is_delayed,
      delayReason: o.delay_reason || null,
      deliveredAt: o.delivered_at || null,
      courierName: o.courier_name || null,
      awbNumber: o.awb_number || null,
      trackingUrl: o.tracking_url || null,
      destination: full
        ? addr
        : { city: addr.city || '', state: addr.state || '', pin: addr.pin ? `${String(addr.pin).slice(0, 3)}***` : '' },
      items,
      stages,
      events: events.map((e) => ({
        status: e.to_status,
        note: e.note,
        location: e.location || null,
        source: e.source || 'system',
        at: e.created_at,
      })),
    };
  }

  function verifyWebhook(provider, req) {
    const secret = env.COURIER_WEBHOOK_SECRET || env.SHIPROCKET_WEBHOOK_TOKEN;
    if (!secret) return env.NODE_ENV !== 'production' && !env.RENDER;
    const header = req.headers['x-api-key'] || req.headers['x-courier-token'] || req.headers['x-shiprocket-token'] || '';
    return safeEqual(header, secret);
  }

  /** Processes a courier webhook/sync payload and records any new status/scan/EDD/delay. */
  async function applyCourierUpdate({ awb, orderNumber, trackingId, rawStatus, location, note, edd, courierName }) {
    const cleanStatus = String(rawStatus || '').trim().toLowerCase();
    const mapped = COURIER_STATUS_MAP.get(cleanStatus) || null;
    const key = String(awb || trackingId || orderNumber || '').trim();
    if (!key) return { ok: false, reason: 'missing_identifier' };

    let notifyEvent = null;
    const updated = await db.tx(async (t) => {
      const o = (await t.query(
        `SELECT * FROM orders
          WHERE upper(awb_number) = upper($1) OR upper(tracking_id) = upper($1) OR upper(order_number) = upper($1)
          FOR UPDATE`,
        [key],
      )).rows[0];
      if (!o) return null;

      const nextStatus = mapped || o.status;
      const isDelayed = cleanStatus.includes('delay') || cleanStatus.includes('undelivered') || (edd && o.estimated_delivery_at && new Date(edd) > new Date(o.estimated_delivery_at));
      const sets = ['updated_at = now()'];
      const params = [o.id];

      if (nextStatus !== o.status) {
        params.push(nextStatus);
        sets.push(`status = $${params.length}`);
        if (nextStatus === 'delivered') {
          sets.push(`delivered_at = COALESCE(delivered_at, now())`, `is_delayed = false`);
          if (o.payment_method === 'cod' && o.payment_status === 'cod_pending') sets.push(`payment_status = 'paid'`);
        }
        notifyEvent = nextStatus;
      }
      if (courierName && !o.courier_name) {
        params.push(courierName);
        sets.push(`courier_name = $${params.length}`);
      }
      if (edd) {
        params.push(new Date(edd).toISOString());
        sets.push(`estimated_delivery_at = $${params.length}`);
      }
      if (isDelayed && nextStatus !== 'delivered') {
        sets.push(`is_delayed = true`);
        if (note) { params.push(String(note).slice(0, 240)); sets.push(`delay_reason = $${params.length}`); }
        if (!notifyEvent) notifyEvent = 'delayed';
      }

      await t.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $1`, params);
      await t.query(
        `INSERT INTO order_events (order_id, from_status, to_status, note, location, source, actor)
         VALUES ($1, $2, $3, $4, $5, 'courier', $6)`,
        [o.id, o.status, nextStatus, note || `Courier scan: ${rawStatus || nextStatus}`, location || null, courierName ? `courier:${courierName}` : 'courier'],
      );
      return o;
    });

    if (!updated) return { ok: false, reason: 'order_not_found' };
    if (notifyEvent) notifier?.notify(updated.id, notifyEvent, courierName ? `via ${courierName}` : undefined);
    return { ok: true, orderNumber: updated.order_number, status: mapped || updated.status };
  }

  /** Syncs tracking from Shiprocket / Delhivery if API credentials are configured. */
  async function syncShipment(orderNumber) {
    const o = (await db.query('SELECT * FROM orders WHERE order_number = $1', [orderNumber])).rows[0];
    if (!o) throw Object.assign(new Error('Order not found.'), { status: 404 });
    if (!o.awb_number) throw Object.assign(new Error('Add an AWB / tracking number first before syncing with the courier.'), { status: 400 });

    if (env.DELHIVERY_TOKEN && /delhivery/i.test(o.courier_name || '')) {
      const res = await fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(o.awb_number)}`, {
        headers: { Authorization: `Token ${env.DELHIVERY_TOKEN}` },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) throw Object.assign(new Error(`Delhivery returned HTTP ${res.status}`), { status: 502 });
      const json = await res.json();
      const pkg = json.ShipmentData?.[0]?.Shipment;
      if (!pkg) return { synced: false, message: 'No scan data returned yet by Delhivery.' };
      const st = pkg.Status?.Status;
      const loc = pkg.Status?.StatusLocation;
      const edd = pkg.ExpectedDeliveryDate;
      const r = await applyCourierUpdate({ awb: o.awb_number, rawStatus: st, location: loc, note: pkg.Status?.Instructions || st, edd, courierName: 'Delhivery' });
      return { synced: true, ...r };
    }

    if (env.SHIPROCKET_TOKEN) {
      const res = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(o.awb_number)}`, {
        headers: { Authorization: `Bearer ${env.SHIPROCKET_TOKEN}` },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) throw Object.assign(new Error(`Shiprocket returned HTTP ${res.status}`), { status: 502 });
      const json = await res.json();
      const td = json.tracking_data;
      const scan = td?.shipment_track_activities?.[0];
      const st = td?.shipment_track?.[0]?.current_status || scan?.activity;
      if (!st) return { synced: false, message: 'No scan events returned yet by Shiprocket.' };
      const r = await applyCourierUpdate({
        awb: o.awb_number,
        rawStatus: st,
        location: scan?.location || null,
        note: scan?.activity || st,
        edd: td?.etd || null,
        courierName: td?.shipment_track?.[0]?.courier_name || o.courier_name || 'Shiprocket',
      });
      return { synced: true, ...r };
    }

    return { synced: false, message: 'Courier API token not configured (set SHIPROCKET_TOKEN or DELHIVERY_TOKEN to auto-sync; manual updates & webhooks work anytime).' };
  }

  /** Marks active shipments past their EDD as delayed automatically. */
  async function flagOverdueShipments() {
    const rows = (await db.query(`
      SELECT id FROM orders
       WHERE status IN ('confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'out_for_delivery')
         AND estimated_delivery_at IS NOT NULL
         AND estimated_delivery_at < now()
         AND is_delayed = false`)).rows;
    for (const { id } of rows) {
      await db.query(`UPDATE orders SET is_delayed = true, delay_reason = COALESCE(delay_reason, 'Passed expected delivery date'), updated_at = now() WHERE id = $1`, [id]);
    }
    if (rows.length) log?.info?.(`[courier] flagged ${rows.length} overdue shipment(s) as delayed`);
    return rows.length;
  }

  /** Periodically polls active AWB shipments when a courier API token is configured. */
  async function syncActiveShipments(limit = 15) {
    if (!env.SHIPROCKET_TOKEN && !env.DELHIVERY_TOKEN) return 0;
    const rows = (await db.query(
      `SELECT order_number FROM orders
        WHERE awb_number IS NOT NULL AND status IN ('packed', 'shipped', 'in_transit', 'out_for_delivery')
        ORDER BY updated_at ASC LIMIT $1`,
      [limit],
    )).rows;
    let synced = 0;
    for (const r of rows) {
      try {
        const res = await syncShipment(r.order_number);
        if (res?.synced) synced += 1;
      } catch (e) {
        log?.warn?.(`[courier] auto-sync ${r.order_number}: ${e.message}`);
      }
    }
    return synced;
  }

  return { getPublicTracking, verifyWebhook, applyCourierUpdate, syncShipment, syncActiveShipments, flagOverdueShipments };
}
