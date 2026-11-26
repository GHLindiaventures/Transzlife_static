-- Database hardening: missing performance indexes and data-integrity constraints.

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id)
-- ;;
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items (product_id)
-- ;;
CREATE INDEX IF NOT EXISTS orders_awb_upper_idx ON orders (upper(awb_number)) WHERE awb_number IS NOT NULL
-- ;;
CREATE INDEX IF NOT EXISTS orders_overdue_idx ON orders (estimated_delivery_at)
  WHERE is_delayed = false AND estimated_delivery_at IS NOT NULL
    AND status IN ('confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'out_for_delivery')
-- ;;
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications (status, created_at DESC)
-- ;;
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages (status, created_at DESC)
-- ;;
DO $$ BEGIN
  ALTER TABLE inventory ADD CONSTRAINT inv_on_hand_nonneg CHECK (on_hand >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$
-- ;;
DO $$ BEGIN
  ALTER TABLE inventory ADD CONSTRAINT inv_reserved_le_on_hand CHECK (reserved <= on_hand);
EXCEPTION WHEN duplicate_object THEN NULL; END $$
-- ;;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_status_chk CHECK (
    status IN ('pending_payment', 'confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'returned', 'rto')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$
-- ;;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_payment_status_chk CHECK (
    payment_status IN ('pending', 'paid', 'cod_pending', 'failed', 'expired', 'refunded', 'partially_refunded')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$
