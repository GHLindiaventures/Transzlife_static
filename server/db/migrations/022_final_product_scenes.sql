-- New lifestyle photos (26 Nov 2026) for Liver Booster and Reviva: built-in product photos move to the -v3
-- files made by scripts/gallery/import-final-products.mjs. Dashboard uploads (storage_key set) are untouched.
UPDATE product_media m
   SET url = v.new_url, thumb_url = NULL
  FROM (VALUES
    ('/img/p/liver-v2.webp',  '/img/p/liver-v3.webp'),
    ('/img/p/reviva-v2.webp', '/img/p/reviva-v3.webp'),
    ('/img/p/liver.webp',     '/img/p/liver-v3.webp'),
    ('/img/p/reviva.webp',    '/img/p/reviva-v3.webp')
  ) AS v(old_url, new_url)
 WHERE m.storage_key IS NULL AND m.url = v.old_url
