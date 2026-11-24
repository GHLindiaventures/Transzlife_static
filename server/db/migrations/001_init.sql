-- TranzLife shop: customers, sign-in, catalogue, stock, orders and payments.
-- Money is stored in paise (integer). Orders keep a snapshot of names, prices and the address,
-- so later catalogue edits never change a past order.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE TABLE customers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone              text NOT NULL UNIQUE,              -- 10-digit Indian mobile, no +91
  name               text,
  email              text,
  marketing_consent  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz
)
-- ;;
CREATE TABLE otp_codes (
  id          bigserial PRIMARY KEY,
  phone       text NOT NULL,
  code_hash   text NOT NULL,                           -- HMAC of the code, never the code itself
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  used_at     timestamptz,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC)
-- ;;
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text NOT NULL UNIQUE,                    -- SHA-256 of the cookie token
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_agent   text,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
)
-- ;;
CREATE INDEX sessions_customer_idx ON sessions (customer_id)
-- ;;
CREATE TABLE addresses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name         text NOT NULL,
  phone        text NOT NULL,
  line1        text NOT NULL,
  line2        text,
  city         text NOT NULL,
  state        text NOT NULL,
  pin          text NOT NULL,
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX addresses_customer_idx ON addresses (customer_id)
-- ;;
CREATE TABLE products (
  id          text PRIMARY KEY,                         -- same slug as the site, e.g. 'liver-booster'
  name        text NOT NULL,
  format      text,
  size        text,
  price       int NOT NULL CHECK (price >= 0),          -- paise
  mrp         int NOT NULL CHECK (mrp >= 0),            -- paise
  gst_rate    numeric(5,2),                             -- % (to be confirmed by the client)
  hsn_code    text,
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE TABLE pack_options (
  qty          int PRIMARY KEY CHECK (qty > 0),
  label        text NOT NULL,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0
)
-- ;;
CREATE TABLE settings (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL
)
-- ;;
CREATE TABLE inventory (
  product_id   text PRIMARY KEY REFERENCES products(id),
  on_hand      int NOT NULL DEFAULT 0,                  -- physically in stock
  reserved     int NOT NULL DEFAULT 0 CHECK (reserved >= 0),  -- held by unpaid orders
  low_stock_at int NOT NULL DEFAULT 10
)
-- ;;
CREATE TABLE stock_movements (
  id          bigserial PRIMARY KEY,
  product_id  text NOT NULL REFERENCES products(id),
  change      int NOT NULL,                             -- units (+ restock, - sale)
  reason      text NOT NULL,                            -- seed / sale / release / restock / return / adjust
  ref         text,                                     -- order number etc.
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE SEQUENCE order_number_seq START 1001
-- ;;
CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     text NOT NULL UNIQUE,                -- shown to customers, e.g. TZL-001001
  customer_id      uuid NOT NULL REFERENCES customers(id),
  idempotency_key  text,
  email            text,
  phone            text NOT NULL,
  ship_address     jsonb NOT NULL,                      -- snapshot at purchase
  subtotal         int NOT NULL,
  discount         int NOT NULL DEFAULT 0,
  shipping         int NOT NULL DEFAULT 0,
  tax              int NOT NULL DEFAULT 0,
  total            int NOT NULL,
  currency         text NOT NULL DEFAULT 'INR',
  payment_method   text NOT NULL,                       -- upi / card / netbanking / cod
  status           text NOT NULL,                       -- pending_payment / confirmed / packed / shipped / out_for_delivery / delivered / cancelled / refunded / returned / rto
  payment_status   text NOT NULL,                       -- pending / paid / cod_pending / failed / expired / refunded
  stock_committed  boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, idempotency_key)
)
-- ;;
CREATE INDEX orders_customer_idx ON orders (customer_id, created_at DESC)
-- ;;
CREATE INDEX orders_status_idx ON orders (status, created_at)
-- ;;
CREATE TABLE order_items (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  text NOT NULL REFERENCES products(id),
  name        text NOT NULL,
  size        text,
  pack        int NOT NULL,
  qty         int NOT NULL,
  unit_price  int NOT NULL,                             -- price of one pack, paise
  unit_mrp    int NOT NULL,
  line_total  int NOT NULL
)
-- ;;
CREATE TABLE order_events (
  id           bigserial PRIMARY KEY,
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  note         text,
  actor        text NOT NULL,                           -- customer / system / razorpay / staff:<email>
  created_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX order_events_order_idx ON order_events (order_id, created_at)
-- ;;
CREATE TABLE payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id),
  provider             text NOT NULL,                   -- razorpay
  provider_order_id    text UNIQUE,
  provider_payment_id  text UNIQUE,
  amount               int NOT NULL,
  method               text,
  status               text NOT NULL,                   -- created / paid / failed
  error                text,
  raw                  jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX payments_order_idx ON payments (order_id)
-- ;;
CREATE TABLE webhook_events (
  provider      text NOT NULL,
  event_id      text NOT NULL,
  event_type    text,
  payload       jsonb,
  received_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
)
