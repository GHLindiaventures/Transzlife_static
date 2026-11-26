-- Website text content as database documents (blogs, FAQ, About, Contact, footer, home copy, policies, ...).
-- One row per document; "data" is the JSON the website renders. Missing documents are created once from the
-- built-in starting copy at server start (server/shop/site-docs.js); after that the database is the only source.
CREATE TABLE site_docs (
  key         text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
)
