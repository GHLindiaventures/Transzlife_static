-- Phase 4: ingredient library managed from the dashboard (seeded from src/store/data/ingredients.js),
-- and the compliance centre: company licences / certificates with expiry dates and private documents.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE TABLE ingredients (
  id          text PRIMARY KEY,                       -- same slug the products use, e.g. 'tulsi'
  name        text NOT NULL,
  alt         text,                                   -- other name, e.g. 'Holy Basil'
  latin       text,
  type        text NOT NULL DEFAULT 'herb',           -- herb / oil / nutrient / homeo
  part        text,                                   -- part used, e.g. 'Leaf'
  note        text,                                   -- traditional use (not a product claim)
  photo_url   text,                                   -- uploaded photo (null = built-in photo)
  photo_key   text,                                   -- key in the product-media bucket
  sort_order  int NOT NULL DEFAULT 100,
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE TABLE certificates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,                       -- e.g. 'AYUSH manufacturing licence'
  kind           text NOT NULL,                       -- licence / certificate / registration / test_report
  issuer         text,                                -- e.g. 'Directorate of Indian Medicine, Tamil Nadu'
  number         text,                                -- licence / certificate number
  products       text[] NOT NULL DEFAULT '{}',        -- empty = applies to the company
  issued_on      date,
  expires_on     date,                                -- null = does not expire
  document_key   text,                                -- key in the private "documents" bucket
  document_name  text,
  document_type  text,
  show_on_site   boolean NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX certificates_expiry_idx ON certificates (expires_on)
