-- Customer-started returns: a return policy that the owner controls (window + per-product eligibility),
-- the extra statuses (under review / approved / pickup scheduled / refund initiated), a status history
-- and the photos customers attach. Existing staff-logged returns keep working unchanged.

ALTER TABLE products ADD COLUMN returnable boolean NOT NULL DEFAULT true          -- false = never returnable (e.g. opened oral products)
-- ;;
ALTER TABLE products ADD COLUMN return_days int                                    -- null = use the shop-wide window
-- ;;
ALTER TABLE returns ADD COLUMN source text NOT NULL DEFAULT 'staff'                -- staff / customer
-- ;;
ALTER TABLE returns ADD COLUMN reject_reason text
-- ;;
ALTER TABLE returns ADD COLUMN pickup_at timestamptz
-- ;;
ALTER TABLE returns ADD COLUMN pickup_note text
-- ;;
CREATE TABLE return_events (
  id         bigserial PRIMARY KEY,
  return_id  uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  status     text NOT NULL,
  note       text,
  actor      text NOT NULL,                       -- customer / staff:<email> / system
  created_at timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX return_events_idx ON return_events (return_id, created_at)
-- ;;
CREATE TABLE return_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  return_id    uuid REFERENCES returns(id) ON DELETE CASCADE,   -- null until the request is submitted
  url          text NOT NULL,
  thumb_url    text,
  storage_key  text,
  created_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX return_photos_return_idx ON return_photos (return_id)
-- ;;
INSERT INTO settings (key, value) VALUES ('returns_enabled', 'true'), ('return_window_days', '7')
  ON CONFLICT (key) DO NOTHING
