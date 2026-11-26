-- Phase 9: cash-on-delivery confirmation (customer replies YES / NO by SMS or WhatsApp, or staff mark it
-- after a call), a daily summary to the owner, and the stock run-out alert threshold.
-- Statements are separated by "-- ;;" lines (see migrate.js).

ALTER TABLE orders ADD COLUMN cod_confirmation text          -- pending / confirmed / cancel_requested / no_reply (null = not asked)
-- ;;
ALTER TABLE orders ADD COLUMN cod_requested_at timestamptz
-- ;;
ALTER TABLE orders ADD COLUMN cod_confirmed_at timestamptz
-- ;;
ALTER TABLE orders ADD COLUMN cod_confirmed_by text           -- customer / staff:<email>
-- ;;
CREATE INDEX orders_cod_pending_idx ON orders (phone, created_at DESC) WHERE cod_confirmation = 'pending'
-- ;;
INSERT INTO settings (key, value) VALUES
  ('cod_confirmation', 'false'),
  ('daily_summary', '{"enabled":false,"phones":[],"hour":9}'),
  ('stock_alert_days', '14')
ON CONFLICT (key) DO NOTHING