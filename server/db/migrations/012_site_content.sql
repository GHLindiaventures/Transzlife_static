-- Phase 8: website content from the dashboard: the scrolling announcement bar (messages with links and
-- schedules; the bar's colours are a setting) and the homepage (section order / visibility, headings,
-- which products the product sections show and in what order). Statements are separated by "-- ;;".

CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text        text NOT NULL,              -- may use {free_shipping} and {prepaid}: filled from the shop settings
  link_url    text,                       -- a page on this site (/shop) or a full https:// link
  starts_at   timestamptz,                -- null = from now
  ends_at     timestamptz,                -- null = no end
  active      boolean NOT NULL DEFAULT true,
  sort        int NOT NULL DEFAULT 100,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
INSERT INTO announcements (text, link_url, sort, created_by) VALUES
  ('Free delivery on orders over {free_shipping}', '/shop', 10, 'migration 012'),
  ('Extra {prepaid} off on prepaid orders', NULL, 20, 'migration 012'),
  ('Government Recognized & Certified', '/science', 30, 'migration 012'),
  ('Live naturally. Live healthier.', NULL, 40, 'migration 012')
-- ;;
CREATE TABLE home_sections (
  key          text PRIMARY KEY,          -- products / formulations / rich / banner / benefits / strip / story / video / brands / help
  title        text,                      -- product sections only
  subtitle     text,
  product_ids  text[] NOT NULL DEFAULT '{}',   -- product sections: which products, in this order (empty = all)
  visible      boolean NOT NULL DEFAULT true,
  sort         int NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
INSERT INTO home_sections (key, title, subtitle, sort) VALUES
  ('rich', NULL, NULL, 10), ('products', 'Our products', 'Find the formulation for your need.', 20), ('sep', NULL, NULL, 30),
  ('banner', NULL, NULL, 40), ('benefits', NULL, NULL, 50), ('formulations', NULL, NULL, 60), ('strip', NULL, NULL, 70),
  ('story', NULL, NULL, 80), ('video', NULL, NULL, 90), ('brands', NULL, NULL, 100), ('help', NULL, NULL, 110)
-- ;;
INSERT INTO settings (key, value) VALUES ('announcement_style', '{"bg":"#124a2c","fg":"#efc04a","speed":"normal"}')
ON CONFLICT (key) DO NOTHING