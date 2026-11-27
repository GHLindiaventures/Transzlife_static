// Outbound shipping & courier booking (Shiprocket + Delhivery Direct):
//   - Pin-code serviceability & rate check
//   - Order/shipment creation + AWB assignment
//   - Pickup scheduling + shipping label generation
//   - Cancellation sync
// Uses SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD (auto-refreshed 10-day token) or SHIPROCKET_TOKEN,
// or DELHIVERY_TOKEN (+ DELHIVERY_WAREHOUSE).

const SR_BASE = 'https://apiv2.shiprocket.in/v1/external';

export function createShipping({ db, env = process.env, log }) {
  const pickupPin = String(env.PICKUP_PINCODE || '600008');
  const pickupLocation = String(env.SHIPROCKET_PICKUP_LOCATION || 'Primary');
  const srStaticToken = env.SHIPROCKET_TOKEN || '';
  const srEmail = env.SHIPROCKET_EMAIL || '';
  const srPassword = env.SHIPROCKET_PASSWORD || '';
  const delhiveryToken = env.DELHIVERY_TOKEN || '';
  const delhiveryWarehouse = env.DELHIVERY_WAREHOUSE || 'TranzLife Warehouse';

  const shiprocketEnabled = !!(srStaticToken || (srEmail && srPassword));
  const delhiveryEnabled = !!delhiveryToken;

  let cachedSrToken = null;
  let cachedSrExpiresAt = 0;

  async function getShiprocketToken() {
    if (srStaticToken) return srStaticToken;
    if (cachedSrToken && Date.now() < cachedSrExpiresAt) return cachedSrToken;
    const r = await fetch(`${SR_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: srEmail, password: srPassword }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.token) throw Object.assign(new Error(`Shiprocket auth failed: ${body.message || r.status}`), { status: 502 });
    cachedSrToken = body.token;
    cachedSrExpiresAt = Date.now() + 8 * 24 * 3600 * 1000; // refresh before 10-day expiry
    return cachedSrToken;
  }

  async function srFetch(path, opts = {}) {
    const token = await getShiprocketToken();
    const r = await fetch(`${SR_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
      signal: AbortSignal.timeout(12000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`Shiprocket: ${body.message || body.errors || r.status}`), { status: 502 });
    return body;
  }

  async function checkServiceability(pin, { cod = true, weightKg = 0.5 } = {}) {
    const cleanPin = String(pin || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(cleanPin)) throw Object.assign(new Error('Enter a valid 6-digit pin code.'), { status: 400 });

    if (shiprocketEnabled) {
      const qs = new URLSearchParams({
        pickup_postcode: pickupPin,
        delivery_postcode: cleanPin,
        weight: String(weightKg),
        cod: cod ? '1' : '0',
      });
      const data = await srFetch(`/courier/serviceability/?${qs}`);
      const list = data?.data?.available_courier_companies || [];
      if (!list.length) return { serviceable: false, cod: false, estimatedDays: null, couriers: [] };
      const best = [...list].sort((a, b) => Number(a.rate || 9999) - Number(b.rate || 9999))[0];
      return {
        serviceable: true,
        cod: list.some((c) => Number(c.cod) === 1),
        estimatedDays: Number(best.estimated_delivery_days || 4),
        etd: best.etd || null,
        minRate: Number(best.rate || 0),
        couriers: list.slice(0, 5).map((c) => ({
          id: c.courier_company_id,
          name: c.courier_name,
          rate: Number(c.rate || 0),
          etd: c.etd || null,
          days: Number(c.estimated_delivery_days || 0),
        })),
      };
    }

    if (delhiveryEnabled) {
      const r = await fetch(`https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${cleanPin}`, {
        headers: { Authorization: `Token ${delhiveryToken}` },
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json().catch(() => ({}));
      const info = data?.delivery_codes?.[0]?.postal_code;
      if (!info) return { serviceable: false, cod: false, estimatedDays: null, couriers: [] };
      return {
        serviceable: true,
        cod: info.cod === 'Y',
        estimatedDays: 4,
        couriers: [{ id: 'delhivery', name: 'Delhivery', rate: null, days: 4 }],
      };
    }

    return { serviceable: true, cod: true, estimatedDays: 5, manual: true, couriers: [] };
  }

  async function getAvailableCouriers(orderNumber, { weightKg = 0.5 } = {}) {
    const o = (await db.query('SELECT order_number, payment_method, ship_address FROM orders WHERE order_number = $1', [orderNumber])).rows[0];
    if (!o) throw Object.assign(new Error('Order not found.'), { status: 404 });
    const addr = typeof o.ship_address === 'string' ? JSON.parse(o.ship_address) : (o.ship_address || {});
    const svc = await checkServiceability(addr.pin, { cod: o.payment_method === 'cod', weightKg });
    return {
      providers: [
        ...(shiprocketEnabled ? ['shiprocket'] : []),
        ...(delhiveryEnabled ? ['delhivery'] : []),
        'manual',
      ],
      ...svc,
    };
  }

  async function bookShipment(orderNumber, { provider, courierId, courierName: chosenCourier, weightKg = 0.5, actor = 'staff' } = {}) {
    const o = await db.tx(async (t) => {
      const row = (await t.query('SELECT * FROM orders WHERE order_number = $1 FOR UPDATE', [orderNumber])).rows[0];
      if (!row) throw Object.assign(new Error('Order not found.'), { status: 404 });
      if (['cancelled', 'returned', 'rto', 'delivered', 'refunded'].includes(row.status)) {
        throw Object.assign(new Error(`Cannot book shipment for a ${row.status} order.`), { status: 409 });
      }
      if (row.awb_number || row.shipment_id) {
        throw Object.assign(new Error(`Shipment already exists for ${orderNumber} (AWB: ${row.awb_number || row.shipment_id}).`), { status: 409 });
      }
      return row;
    });

    const useProvider = provider || (shiprocketEnabled ? 'shiprocket' : delhiveryEnabled ? 'delhivery' : null);
    if (!useProvider || useProvider === 'manual') {
      throw Object.assign(new Error('No shipping partner API configured (set SHIPROCKET_EMAIL/PASSWORD or DELHIVERY_TOKEN).'), { status: 400 });
    }
    if (useProvider === 'shiprocket' && !shiprocketEnabled) {
      throw Object.assign(new Error('Shiprocket is not configured in environment settings.'), { status: 400 });
    }
    if (useProvider === 'delhivery' && !delhiveryEnabled) {
      throw Object.assign(new Error('Delhivery is not configured in environment settings.'), { status: 400 });
    }

    const items = (await db.query('SELECT product_id, name, pack, qty, unit_price FROM order_items WHERE order_id = $1 ORDER BY id', [o.id])).rows;
    const addr = typeof o.ship_address === 'string' ? JSON.parse(o.ship_address) : (o.ship_address || {});
    const [firstName, ...rest] = String(addr.name || 'Customer').trim().split(/\s+/);
    const lastName = rest.join(' ') || '.';

    try {
      if (useProvider === 'shiprocket') {
        const created = await srFetch('/orders/create/adhoc', {
          method: 'POST',
          body: JSON.stringify({
            order_id: o.order_number,
            order_date: new Date(o.created_at).toISOString().slice(0, 16).replace('T', ' '),
            pickup_location: pickupLocation,
            billing_customer_name: firstName,
            billing_last_name: lastName,
            billing_address: addr.line1 || '',
            billing_address_2: addr.line2 || '',
            billing_city: addr.city || '',
            billing_pincode: String(addr.pin || ''),
            billing_state: addr.state || '',
            billing_country: 'India',
            billing_email: o.email || 'care@tranzlife.in',
            billing_phone: String(addr.phone || o.phone || '').replace(/\D/g, '').slice(-10),
            shipping_is_billing: true,
            order_items: items.map((i) => ({
              name: i.name,
              sku: `${i.product_id}-${i.pack}`,
              units: i.qty,
              selling_price: Number((i.unit_price / 100).toFixed(2)),
            })),
            payment_method: o.payment_method === 'cod' ? 'COD' : 'Prepaid',
            sub_total: Number((o.total / 100).toFixed(2)),
            length: 15,
            breadth: 12,
            height: 8,
            weight: weightKg,
          }),
        });
        const shipmentId = created.shipment_id;
        if (!shipmentId) throw Object.assign(new Error('Shiprocket did not return a shipment ID.'), { status: 502 });

        const awbRes = await srFetch('/courier/assign/awb', {
          method: 'POST',
          body: JSON.stringify({ shipment_id: shipmentId, ...(courierId ? { courier_id: courierId } : {}) }),
        });
        const awbData = awbRes?.response?.data || {};
        const awb = awbData.awb_code || '';
        const courierName = awbData.courier_name || chosenCourier || 'Shiprocket';
        const trackingUrl = awb ? `https://shiprocket.co/tracking/${awb}` : null;
        const edd = awbData.estimated_delivery_date ? new Date(awbData.estimated_delivery_date).toISOString() : o.estimated_delivery_at;
        const chargePaise = awbData.freight_charges != null ? Math.round(Number(awbData.freight_charges) * 100) : null;
        const nextStatus = ['confirmed', 'processing', 'packed', 'shipment_failed'].includes(o.status) ? 'ready_for_pickup' : o.status;

        await db.tx(async (t) => {
          await t.query(
            `UPDATE orders
                SET shipping_provider = 'shiprocket', courier_id = $2, shipment_id = $3,
                    courier_charge = COALESCE($4, courier_charge),
                    courier_name = $5, awb_number = $6, tracking_url = COALESCE($7, tracking_url),
                    estimated_delivery_at = COALESCE($8, estimated_delivery_at),
                    original_edd_at = COALESCE(original_edd_at, $8),
                    status = $9, updated_at = now()
              WHERE id = $1`,
            [o.id, courierId ? String(courierId) : null, String(shipmentId), chargePaise, courierName, awb || null, trackingUrl, edd, nextStatus],
          );
          await t.query(
            `INSERT INTO order_events (order_id, from_status, to_status, note, source, actor)
             VALUES ($1, $2, $3, $4, 'courier', $5)`,
            [o.id, o.status, nextStatus, `Shipment booked via ${courierName}${awb ? ` (AWB ${awb})` : ''} [SR#${shipmentId}]`, actor],
          );
        });
        return { provider: 'shiprocket', shipmentId, awb, courierName, courierCharge: chargePaise, trackingUrl, edd, status: nextStatus };
      }

      // Delhivery Direct manifest
      const payload = {
        shipments: [{
          name: addr.name || 'Customer',
          add: [addr.line1, addr.line2].filter(Boolean).join(', '),
          pin: String(addr.pin || ''),
          city: addr.city || '',
          state: addr.state || '',
          country: 'India',
          phone: String(addr.phone || o.phone || '').replace(/\D/g, '').slice(-10),
          order: o.order_number,
          payment_mode: o.payment_method === 'cod' ? 'COD' : 'Prepaid',
          total_amount: Number((o.total / 100).toFixed(2)),
          cod_amount: o.payment_method === 'cod' ? Number((o.total / 100).toFixed(2)) : 0,
          products_desc: items.map((i) => `${i.name} x${i.qty}`).join(', ').slice(0, 200),
          weight: Math.round(weightKg * 1000),
        }],
        pickup_location: { name: delhiveryWarehouse },
      };
      const r = await fetch('https://track.delhivery.com/api/cmu/create.json', {
        method: 'POST',
        headers: { Authorization: `Token ${delhiveryToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ format: 'json', data: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(12000),
      });
      const body = await r.json().catch(() => ({}));
      const pkg = body?.packages?.[0];
      if (!r.ok || !pkg?.waybill) {
        throw Object.assign(new Error(`Delhivery booking failed: ${pkg?.remarks?.[0] || body?.rmk || r.status}`), { status: 502 });
      }
      const awb = pkg.waybill;
      const trackingUrl = `https://www.delhivery.com/track/package/${awb}`;
      const labelUrl = `https://track.delhivery.com/api/p/packing_slip?wbns=${encodeURIComponent(awb)}`;
      const nextStatus = ['confirmed', 'processing', 'packed', 'shipment_failed'].includes(o.status) ? 'ready_for_pickup' : o.status;

      await db.tx(async (t) => {
        await t.query(
          `UPDATE orders
              SET shipping_provider = 'delhivery', courier_name = 'Delhivery', awb_number = $2,
                  tracking_url = $3, shipping_label_url = $4, status = $5, updated_at = now()
            WHERE id = $1`,
          [o.id, awb, trackingUrl, labelUrl, nextStatus],
        );
        await t.query(
          `INSERT INTO order_events (order_id, from_status, to_status, note, source, actor)
           VALUES ($1, $2, $3, $4, 'courier', $5)`,
          [o.id, o.status, nextStatus, `Shipment booked via Delhivery (AWB ${awb})`, actor],
        );
      });
      return { provider: 'delhivery', awb, courierName: 'Delhivery', trackingUrl, labelUrl, status: nextStatus };
    } catch (err) {
      await db.query(`UPDATE orders SET status = 'shipment_failed', updated_at = now() WHERE id = $1`, [o.id]).catch(() => {});
      await db.query(
        `INSERT INTO order_events (order_id, from_status, to_status, note, source, actor) VALUES ($1,$2,'shipment_failed',$3,'courier',$4)`,
        [o.id, o.status, `Shipment creation failed: ${String(err.message || '').slice(0, 220)}`, actor],
      ).catch(() => {});
      throw err;
    }
  }

  async function schedulePickup(orderNumber, { actor = 'staff' } = {}) {
    const o = (await db.query('SELECT * FROM orders WHERE order_number = $1', [orderNumber])).rows[0];
    if (!o) throw Object.assign(new Error('Order not found.'), { status: 404 });
    if (!o.awb_number) throw Object.assign(new Error('Book shipment / assign an AWB first.'), { status: 400 });
    if (shiprocketEnabled && (o.shipping_provider === 'shiprocket' || !o.shipping_provider)) {
      let shipmentId = o.shipment_id;
      if (!shipmentId) {
        const srOrder = await srFetch(`/orders/show/${encodeURIComponent(o.order_number)}`).catch(() => null);
        shipmentId = srOrder?.data?.shipments?.[0]?.id;
      }
      if (shipmentId) await srFetch('/courier/generate/pickup', { method: 'POST', body: JSON.stringify({ shipment_id: [Number(shipmentId)] }) });
    }
    const nextStatus = o.status === 'packed' ? 'ready_for_pickup' : o.status;
    await db.tx(async (t) => {
      await t.query(
        `UPDATE orders SET pickup_status = 'scheduled', pickup_scheduled_at = COALESCE(pickup_scheduled_at, now()), status = $2, updated_at = now() WHERE id = $1`,
        [o.id, nextStatus],
      );
      await t.query(
        `INSERT INTO order_events (order_id, from_status, to_status, note, source, actor) VALUES ($1,$2,$3,$4,'courier',$5)`,
        [o.id, o.status, nextStatus, `Pickup scheduled with ${o.courier_name || 'courier'}`, actor],
      );
    });
    return { ok: true, pickupStatus: 'scheduled', status: nextStatus };
  }

  async function getLabel(orderNumber) {
    const o = (await db.query('SELECT id, order_number, awb_number, courier_name, shipment_id, shipping_label_url FROM orders WHERE order_number = $1', [orderNumber])).rows[0];
    if (!o) throw Object.assign(new Error('Order not found.'), { status: 404 });
    if (!o.awb_number) throw Object.assign(new Error('No AWB assigned yet. Book shipment first.'), { status: 400 });
    if (o.shipping_label_url) return { labelUrl: o.shipping_label_url };
    if (delhiveryEnabled && /delhivery/i.test(o.courier_name || '')) {
      const url = `https://track.delhivery.com/api/p/packing_slip?wbns=${encodeURIComponent(o.awb_number)}`;
      await db.query('UPDATE orders SET shipping_label_url = $2 WHERE id = $1', [o.id, url]);
      return { labelUrl: url };
    }
    if (shiprocketEnabled) {
      let shipmentId = o.shipment_id;
      if (!shipmentId) {
        const srOrder = await srFetch(`/orders/show/${encodeURIComponent(o.order_number)}`).catch(() => null);
        shipmentId = srOrder?.data?.shipments?.[0]?.id;
      }
      if (!shipmentId) throw Object.assign(new Error('Shiprocket shipment ID not found for this order.'), { status: 404 });
      const res = await srFetch('/courier/generate/label', { method: 'POST', body: JSON.stringify({ shipment_id: [Number(shipmentId)] }) });
      if (!res?.label_url) throw Object.assign(new Error('Shiprocket did not return a label URL.'), { status: 502 });
      await db.query('UPDATE orders SET shipping_label_url = $2 WHERE id = $1', [o.id, res.label_url]);
      return { labelUrl: res.label_url };
    }
    throw Object.assign(new Error('Shipping provider API not configured.'), { status: 400 });
  }

  return {
    shiprocketEnabled,
    delhiveryEnabled,
    checkServiceability,
    getAvailableCouriers,
    bookShipment,
    schedulePickup,
    getLabel,
  };
}
