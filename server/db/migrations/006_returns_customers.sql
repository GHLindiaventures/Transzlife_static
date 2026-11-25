-- Phase 3: returns (request -> received & inspected -> resolved) with per-item condition,
-- and staff notes on customers. Statements are separated by "-- ;;" lines (see migrate.js).

CREATE SEQUENCE return_number_seq START 1001
-- ;;
CREATE TABLE returns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number  text NOT NULL UNIQUE,                 -- RET-001001
  order_id       uuid NOT NULL REFERENCES orders(id),
  status         text NOT NULL,                        -- requested / received / resolved / rejected
  reason         text NOT NULL,                        -- damaged / wrong_item / expired / not_effective / changed_mind / allergy / other
  reason_note    text,
  resolution     text,                                 -- refund / replacement / no_action
  refund_amount  int,                                  -- paise, when resolved with a refund
  staff_note     text,
  created_by     uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  received_at    timestamptz,
  resolved_at    timestamptz
)
-- ;;
CREATE INDEX returns_order_idx ON returns (order_id)
-- ;;
CREATE INDEX returns_status_idx ON returns (status, created_at DESC)
-- ;;
CREATE TABLE return_items (
  id             bigserial PRIMARY KEY,
  return_id      uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id  bigint NOT NULL REFERENCES order_items(id),
  qty            int NOT NULL CHECK (qty > 0),         -- packs, as ordered
  condition      text,                                 -- resellable / damaged / expired (set when received)
  restocked      int NOT NULL DEFAULT 0                -- units put back on sale
)
-- ;;
CREATE TABLE customer_notes (
  id           bigserial PRIMARY KEY,
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id     uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_email  text,
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX customer_notes_customer_idx ON customer_notes (customer_id, created_at DESC)
