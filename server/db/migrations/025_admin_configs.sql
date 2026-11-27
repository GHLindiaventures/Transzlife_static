-- Admin-managed configurations: invoice bank details, billed_by tracking, payment gateway toggles,
-- SEO/marketing tags, social media links, and customer/admin notification templates.
-- Statements are separated by "-- ;;" lines (see migrate.js).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS billed_by_name text,
  ADD COLUMN IF NOT EXISTS billed_by_email text
-- ;;
INSERT INTO settings (key, value) VALUES
  ('company_bank', '{"accountHolder":"TRANZ LIFE BIO SCIENCES PVT LTD","bankName":"City Union Bank","accountNumber":"510909010375994","branch":"Chamiers Road","ifsc":"CIUB0000884"}'::jsonb),
  ('payment_gateways', '{"razorpayEnabled":true,"cashfreeEnabled":true,"activeProvider":"razorpay"}'::jsonb),
  ('marketing_tags', '{"gtmId":"","ga4Id":"","metaPixelId":"","gscVerification":"","metaDomainVerification":""}'::jsonb),
  ('social_links', '[{"key":"instagram","label":"Instagram","url":"","enabled":true},{"key":"facebook","label":"Facebook","url":"","enabled":true},{"key":"youtube","label":"YouTube","url":"","enabled":true},{"key":"linkedin","label":"LinkedIn","url":"","enabled":true},{"key":"x","label":"X","url":"","enabled":true}]'::jsonb),
  ('notification_config', '{"channels":{"email":true,"sms":true,"whatsapp":true},"adminRecipients":{"emails":[],"phones":[]},"adminEvents":{"new_order":true,"payment_confirmed":true,"payment_failed":true,"pending_confirmation":true,"shipment_update":true,"delivery_update":true},"customerEvents":{"confirmed":true,"payment_confirmed":true,"processing":true,"ready_for_pickup":true,"shipped":true,"in_transit":true,"out_for_delivery":true,"delivered":true,"delayed":true,"cancelled":true,"payment_reminder":true},"templates":{}}'::jsonb)
ON CONFLICT (key) DO NOTHING
