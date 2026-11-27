-- Seed official TranzLife company bank details if not yet populated in settings.
INSERT INTO settings (key, value)
VALUES (
  'company_bank',
  '{"accountHolder":"TRANZ LIFE BIO SCIENCES PVT LTD","bankName":"City Union Bank","accountNumber":"510909010375994","branch":"Chamiers Road","ifsc":"CIUB0000884"}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value
WHERE COALESCE(settings.value->>'accountNumber', '') = ''
