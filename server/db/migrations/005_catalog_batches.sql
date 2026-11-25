-- Phase 2: product content managed from the dashboard, product photos (Neon object storage),
-- production batches with expiry (first-expiry-first-out), and batch traceability per order item.
-- Existing products get their content copied from src/store/data/products.js by seed.js.
-- Statements are separated by "-- ;;" lines (see migrate.js).

ALTER TABLE products ADD COLUMN short text
-- ;;
ALTER TABLE products ADD COLUMN tagline text
-- ;;
ALTER TABLE products ADD COLUMN badge text
-- ;;
ALTER TABLE products ADD COLUMN accent text
-- ;;
ALTER TABLE products ADD COLUMN tint text
-- ;;
ALTER TABLE products ADD COLUMN concerns text[] NOT NULL DEFAULT '{}'
-- ;;
ALTER TABLE products ADD COLUMN sort_order int NOT NULL DEFAULT 100
-- ;;
-- marketing copy: highlights, summary, description, benefits, ingredients (ids), routine, howToUse,
-- whoFor, precautions, faqs, brochure
ALTER TABLE products ADD COLUMN content jsonb NOT NULL DEFAULT '{}'
-- ;;
-- label declarations (Legal Metrology / Drugs & Cosmetics): netQuantity, manufacturer, manufacturerAddress,
-- licenceNo, countryOfOrigin, shelfLifeMonths, storage, consumerCare, certifications[]
ALTER TABLE products ADD COLUMN compliance jsonb NOT NULL DEFAULT '{}'
-- ;;
ALTER TABLE products ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()
-- ;;
CREATE TABLE product_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,                  -- full image (bucket URL, or a /public path for built-in photos)
  thumb_url   text,
  storage_key text,                           -- key in the product-media bucket (null for built-in photos)
  alt         text,
  width       int,
  height      int,
  sort        int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX product_media_product_idx ON product_media (product_id, sort)
-- ;;
CREATE TABLE batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     text NOT NULL REFERENCES products(id),
  batch_no       text NOT NULL,
  mfg_date       date NOT NULL,
  expiry_date    date NOT NULL CHECK (expiry_date > mfg_date),
  qty_received   int NOT NULL CHECK (qty_received > 0),
  qty_remaining  int NOT NULL CHECK (qty_remaining >= 0),
  notes          text,
  written_off_at timestamptz,                 -- set when an expired batch is taken out of stock
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, batch_no)
)
-- ;;
CREATE INDEX batches_fefo_idx ON batches (product_id, expiry_date) WHERE qty_remaining > 0 AND written_off_at IS NULL
-- ;;
CREATE TABLE order_item_batches (
  order_item_id bigint NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  batch_id      uuid NOT NULL REFERENCES batches(id),
  qty           int NOT NULL CHECK (qty > 0),
  PRIMARY KEY (order_item_id, batch_id)
)
-- ;;
CREATE INDEX order_item_batches_batch_idx ON order_item_batches (batch_id)
