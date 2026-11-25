-- Admin dashboard: staff accounts (roles + 2FA), staff sessions, audit log, refunds.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE TABLE staff_users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL UNIQUE,            -- stored lower-case
  name                  text NOT NULL,
  role                  text NOT NULL CHECK (role IN ('owner', 'manager', 'support')),
  password_hash         text NOT NULL,                   -- scrypt, never the password
  must_change_password  boolean NOT NULL DEFAULT true,   -- temporary password until first sign-in
  totp_secret           text,                            -- authenticator-app secret (base32)
  totp_enabled          boolean NOT NULL DEFAULT false,
  totp_last_step        bigint,                          -- stops the same 2FA code being reused
  failed_logins         int NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  last_login_at         timestamptz
)
-- ;;
CREATE TABLE staff_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    text NOT NULL UNIQUE,                    -- SHA-256 of the cookie token
  staff_id      uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  user_agent    text,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
)
-- ;;
CREATE INDEX staff_sessions_staff_idx ON staff_sessions (staff_id)
-- ;;
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  staff_id    uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_email text,                                      -- kept even if the account is removed
  action      text NOT NULL,                             -- e.g. order.status, product.update, stock.adjust
  entity      text NOT NULL,                             -- order / product / customer / staff / settings
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id, created_at DESC)
-- ;;
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC)
-- ;;
CREATE TABLE refunds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id),
  payment_id          uuid REFERENCES payments(id),      -- null for cash-on-delivery refunds paid by hand
  amount              int NOT NULL CHECK (amount > 0),   -- paise
  reason              text NOT NULL,
  method              text NOT NULL,                     -- razorpay / manual
  provider_refund_id  text UNIQUE,
  status              text NOT NULL,                     -- pending / processed / failed
  staff_id            uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  raw                 jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX refunds_order_idx ON refunds (order_id)
-- ;;
ALTER TABLE orders ADD COLUMN cancel_reason text
-- ;;
ALTER TABLE orders ADD COLUMN staff_note text
-- ;;
ALTER TABLE customers ADD COLUMN deleted_at timestamptz
