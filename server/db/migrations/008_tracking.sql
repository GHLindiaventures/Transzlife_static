-- Phase 5: first-party visitor analytics, server-side carts, wishlists and opt-in reminders.
-- Privacy (India DPDP Act): no IP addresses, no fingerprinting. A visitor is a random id the
-- browser keeps only after the visitor accepts analytics; without consent only anonymous page
-- views are counted (visitor_id is null). Raw events are deleted after 13 months.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE TABLE visitors (
  id            uuid PRIMARY KEY,                     -- random id made by the browser
  customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,   -- linked when they sign in
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  device        text                                  -- mobile / tablet / desktop
)
-- ;;
CREATE INDEX visitors_customer_idx ON visitors (customer_id) WHERE customer_id IS NOT NULL
-- ;;
CREATE TABLE visits (
  id            uuid PRIMARY KEY,                     -- ends after 30 minutes without activity
  visitor_id    uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_at       timestamptz NOT NULL DEFAULT now(),
  is_new        boolean NOT NULL DEFAULT false,       -- the visitor's first visit
  landing_path  text,
  referrer_host text,
  source        text NOT NULL DEFAULT 'direct',       -- utm_source, 'share', a referrer group, or 'direct'
  medium        text,
  campaign      text,
  device        text,
  browser       text,
  os            text,
  pages         int NOT NULL DEFAULT 0
)
-- ;;
CREATE INDEX visits_started_idx ON visits (started_at)
-- ;;
CREATE INDEX visits_visitor_idx ON visits (visitor_id, started_at)
-- ;;
CREATE TABLE events (
  id          bigserial PRIMARY KEY,
  event_id    uuid NOT NULL UNIQUE,                   -- made by the browser: a retried send is stored once
  visitor_id  uuid REFERENCES visitors(id) ON DELETE CASCADE,   -- null = anonymous page view (no consent)
  visit_id    uuid REFERENCES visits(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  name        text NOT NULL,                          -- page_view / product_click / add_to_cart / share / …
  path        text,
  product_id  text,
  props       jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX events_name_idx ON events (name, created_at)
-- ;;
CREATE INDEX events_product_idx ON events (product_id, created_at) WHERE product_id IS NOT NULL
-- ;;
CREATE INDEX events_visitor_idx ON events (visitor_id, created_at)
-- ;;
CREATE INDEX events_customer_idx ON events (customer_id, created_at) WHERE customer_id IS NOT NULL
-- ;;
-- the browser's cart, mirrored so abandoned carts can be seen (one per visitor)
CREATE TABLE carts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id    uuid NOT NULL UNIQUE REFERENCES visitors(id) ON DELETE CASCADE,
  customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,
  items         jsonb NOT NULL DEFAULT '[]',          -- [{ id, pack, qty }]
  item_count    int NOT NULL DEFAULT 0,
  value         int NOT NULL DEFAULT 0,               -- paise, at current prices
  started_at    timestamptz,                          -- when it last went from empty to filled
  updated_at    timestamptz NOT NULL DEFAULT now(),
  checkout_at   timestamptz,                          -- reached the checkout page
  order_id      uuid REFERENCES orders(id) ON DELETE SET NULL,   -- bought
  reminded_at   timestamptz
)
-- ;;
CREATE INDEX carts_open_idx ON carts (updated_at) WHERE item_count > 0 AND order_id IS NULL
-- ;;
CREATE TABLE wishlists (
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id   text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
)
-- ;;
-- cart and refill reminders (only to customers who opted in); one per cart fill / per last order
CREATE TABLE marketing_messages (
  id           bigserial PRIMARY KEY,
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind         text NOT NULL,                         -- cart / reorder
  ref          text NOT NULL,                         -- cart id + fill time, or the last order number
  channel      text NOT NULL,                         -- sms / whatsapp
  body         text NOT NULL,
  status       text NOT NULL,                         -- sending / sent / failed
  provider_id  text,
  error        text,
  staff_email  text,                                  -- null when sent automatically
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  UNIQUE (customer_id, kind, ref)
)
-- ;;
-- which visit an order came from (traffic source → revenue)
ALTER TABLE orders ADD COLUMN visitor_id uuid
-- ;;
ALTER TABLE orders ADD COLUMN visit_id uuid
-- ;;
ALTER TABLE orders ADD COLUMN source text
-- ;;
ALTER TABLE customers ADD COLUMN marketing_consent_at timestamptz
-- ;;
INSERT INTO settings (key, value) VALUES ('reminders_cart', 'false'), ('reminders_reorder', 'false'),
  ('cart_reminder_hours', '4'), ('reorder_days', '30')
ON CONFLICT (key) DO NOTHING