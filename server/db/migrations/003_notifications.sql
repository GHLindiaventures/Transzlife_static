-- Order update messages to customers (Twilio SMS / WhatsApp). One row per order + event + channel,
-- so a message is never sent twice (e.g. when both the browser and a webhook confirm a payment).
CREATE TABLE notifications (
  id           bigserial PRIMARY KEY,
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event        text NOT NULL,                 -- confirmed / shipped / out_for_delivery / delivered / cancelled
  channel      text NOT NULL,                 -- sms / whatsapp
  to_phone     text NOT NULL,
  body         text NOT NULL,
  status       text NOT NULL,                 -- sending / sent / failed
  provider_id  text,                          -- Twilio message SID
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  UNIQUE (order_id, event, channel)
)
-- ;;
CREATE INDEX notifications_order_idx ON notifications (order_id, created_at)
