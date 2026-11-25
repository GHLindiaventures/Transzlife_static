-- Phase 7: scheduled offers and flash sales, product badges with truth rules, and a record of every
-- discount given on an order (for discount / campaign reports). The struck-through price on the site is
-- always the MRP printed on the pack; an offer can only lower the selling price, never raise it.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE TABLE offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                       -- shown to customers, e.g. "Diwali offer"
  kind            text NOT NULL DEFAULT 'sale',        -- sale / flash (flash = short, with a countdown)
  product_ids     text[] NOT NULL DEFAULT '{}',        -- empty = every product
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'flat', 'price')),
  value           int NOT NULL CHECK (value > 0),      -- percent: whole %, flat / price: paise
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL CHECK (ends_at > starts_at),
  active          boolean NOT NULL DEFAULT true,
  show_countdown  boolean NOT NULL DEFAULT false,
  badge           text,                                -- hot_deal / limited_offer / special_discount while it runs
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX offers_window_idx ON offers (starts_at, ends_at) WHERE active
-- ;;
-- badge chosen by staff: { key, text?, tone, enabled, startsAt?, endsAt?, auto? }
ALTER TABLE products ADD COLUMN badge_config jsonb
-- ;;
ALTER TABLE order_items ADD COLUMN list_price int        -- one pack at the regular selling price (paise)
-- ;;
ALTER TABLE order_items ADD COLUMN offer_id uuid REFERENCES offers(id) ON DELETE SET NULL
-- ;;
CREATE TABLE order_discounts (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind        text NOT NULL,                           -- offer / pack / prepaid
  ref_id      text,                                    -- offer id, pack size
  label       text,
  amount      int NOT NULL CHECK (amount >= 0),        -- paise
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX order_discounts_order_idx ON order_discounts (order_id)
-- ;;
CREATE INDEX order_discounts_kind_idx ON order_discounts (kind, ref_id)
-- ;;
-- the old free-text badges become structured ones ("Bestseller" is now decided by real sales)
UPDATE products SET badge_config = CASE
    WHEN badge ILIKE 'best%seller' THEN jsonb_build_object('key', 'auto', 'enabled', true)
    WHEN badge ILIKE 'new%' THEN jsonb_build_object('key', 'new_arrival', 'enabled', true, 'startsAt', now())
    ELSE jsonb_build_object('key', 'custom', 'text', badge, 'tone', 'forest', 'enabled', true)
  END
 WHERE badge IS NOT NULL AND badge <> ''