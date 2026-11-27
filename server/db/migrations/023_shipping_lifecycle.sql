-- 9-stage order lifecycle + exceptional statuses + shipping metadata (courier selection, charges, pickup status).
-- Statements are separated by "-- ;;" lines (see migrate.js).

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_chk
-- ;;
ALTER TABLE orders ADD CONSTRAINT orders_status_chk CHECK (
  status IN (
    'pending_payment', 'confirmed', 'processing', 'packed', 'ready_for_pickup',
    'shipped', 'in_transit', 'out_for_delivery', 'delivered',
    'cancelled', 'shipment_failed', 'delivery_failed', 'rto', 'returned', 'refund_initiated', 'refunded'
  )
)
-- ;;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_provider text,
  ADD COLUMN IF NOT EXISTS courier_id text,
  ADD COLUMN IF NOT EXISTS shipment_id text,
  ADD COLUMN IF NOT EXISTS courier_charge integer,
  ADD COLUMN IF NOT EXISTS pickup_status text NOT NULL DEFAULT 'not_scheduled'
    CHECK (pickup_status IN ('not_scheduled', 'scheduled', 'picked_up')),
  ADD COLUMN IF NOT EXISTS pickup_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_label_url text
