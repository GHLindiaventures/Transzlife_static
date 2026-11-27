-- Unique financial-year GST invoice numbers (e.g. TZL/26-27/00001) on confirmed/paid orders.
-- Statements are separated by "-- ;;" lines (see migrate.js).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz
-- ;;
CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_idx ON orders (invoice_number) WHERE invoice_number IS NOT NULL
-- ;;
CREATE TABLE IF NOT EXISTS invoice_counters (
  fy       text PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0
)
