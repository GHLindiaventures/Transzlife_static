-- Order Delivery Tracking System:
-- Adds unique tracking_id, courier details, EDD, delay tracking, and event location/source.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_id text
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name text
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_number text
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url text
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_edd_at timestamptz
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_delayed boolean NOT NULL DEFAULT false
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delay_reason text
-- ;;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz
-- ;;
UPDATE orders SET tracking_id = 'TRK-' || order_number WHERE tracking_id IS NULL
-- ;;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_id_idx ON orders (tracking_id)
-- ;;
ALTER TABLE order_events ADD COLUMN IF NOT EXISTS location text
-- ;;
ALTER TABLE order_events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system'
