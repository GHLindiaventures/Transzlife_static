-- Phase 6: product reviews from verified buyers (a delivered order with the product), photos only,
-- automatic publishing with suspicious reviews held for staff, helpful votes and reports, public
-- replies, and rating totals kept on products for fast pages. Review-request messages reuse
-- marketing_messages (kind 'review', ref = order number). Statements are separated by "-- ;;".

CREATE TABLE reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id       uuid REFERENCES orders(id) ON DELETE SET NULL,      -- the delivered order that makes it a verified purchase
  verified       boolean NOT NULL DEFAULT true,
  rating         int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title          text,
  body           text NOT NULL,
  display_name   text NOT NULL,                       -- "Priya S." (never the phone number)
  status         text NOT NULL DEFAULT 'pending',     -- pending / approved / rejected / removed
  hold_reasons   text[] NOT NULL DEFAULT '{}',        -- why it was held for a person to check
  reject_reason  text,                                -- spam / offensive / personal_info / off_topic / medical_claim / not_genuine
  helpful_count  int NOT NULL DEFAULT 0,
  report_count   int NOT NULL DEFAULT 0,
  reply          text,                                -- public reply from TranzLife
  reply_at       timestamptz,
  reply_by       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz,
  moderated_by   text,                                -- staff email, or 'auto'
  UNIQUE (customer_id, product_id)
)
-- ;;
CREATE INDEX reviews_product_idx ON reviews (product_id, status, created_at DESC)
-- ;;
CREATE INDEX reviews_status_idx ON reviews (status, created_at DESC)
-- ;;
CREATE TABLE review_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid REFERENCES reviews(id) ON DELETE CASCADE,   -- null while uploaded but not yet posted
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  url          text NOT NULL,
  thumb_url    text,
  storage_key  text,
  width        int,
  height       int,
  sort         int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX review_media_review_idx ON review_media (review_id, sort)
-- ;;
CREATE TABLE review_votes (
  review_id   uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter       text NOT NULL,                          -- 'c:<customer id>' or 'v:<visitor id>'
  kind        text NOT NULL,                          -- helpful / report
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, voter, kind)
)
-- ;;
ALTER TABLE products ADD COLUMN rating_avg numeric(3,2) NOT NULL DEFAULT 0
-- ;;
ALTER TABLE products ADD COLUMN rating_count int NOT NULL DEFAULT 0
-- ;;
ALTER TABLE products ADD COLUMN rating_hist int[] NOT NULL DEFAULT '{0,0,0,0,0}'   -- 1★ … 5★
-- ;;
INSERT INTO settings (key, value) VALUES ('review_requests', 'false'), ('review_request_days', '7')
ON CONFLICT (key) DO NOTHING