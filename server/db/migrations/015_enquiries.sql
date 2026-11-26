-- Contact-form enquiries and newsletter sign-ups, so they land in our own database
-- (server-side validated, rate limited) instead of only a WhatsApp / email hand-off.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE TABLE IF NOT EXISTS contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text NOT NULL,
  topic       text NOT NULL DEFAULT '',
  product     text NOT NULL DEFAULT '',
  city        text NOT NULL DEFAULT '',
  method      text NOT NULL DEFAULT '',            -- preferred contact: Phone / WhatsApp / Email
  message     text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled', 'spam')),
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages (created_at DESC)
-- ;;
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email            text PRIMARY KEY,
  source           text NOT NULL DEFAULT 'footer',  -- which form: footer / home
  created_at       timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at  timestamptz
)
