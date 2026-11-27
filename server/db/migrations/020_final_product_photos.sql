-- Final product photos (26 Nov 2026) for PulmoClear gummies, BreatheFree inhaler, Liver Booster and Reviva:
-- built-in photos move to the new files (scripts/gallery/import-final-products.mjs). Photos uploaded in the
-- dashboard (storage_key set) are left alone. The old second gummies photo (the previous jar) is removed.
-- Statements are separated by "-- ;;" lines (see migrate.js).

DELETE FROM product_media WHERE storage_key IS NULL AND url = '/img/p/pulmoclear-jar.webp'
-- ;;
UPDATE product_media m
   SET url = v.new_url, thumb_url = NULL
  FROM (VALUES
    ('/img/p/pulmoclear.webp',  '/img/p/pulmoclear-v2.webp'),
    ('/img/p/liver.webp',       '/img/p/liver-v2.webp'),
    ('/img/p/reviva.webp',      '/img/p/reviva-v2.webp'),
    ('/img/p/breathefree.webp', '/img/p/breathefree-v2.webp')
  ) AS v(old_url, new_url)
 WHERE m.storage_key IS NULL AND m.url = v.old_url
