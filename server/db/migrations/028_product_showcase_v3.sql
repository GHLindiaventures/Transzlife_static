-- The home "Our products" cards read each product's `showcase` image from the site.PRODUCTS document in site_docs.
-- That stored copy still pointed at the old showcase files; move the four products that have newer ones to -v3.
-- Only exact old built-in paths are replaced, so anything set from the dashboard is left alone.
UPDATE site_docs d
   SET data = (
     SELECT jsonb_agg(
              CASE WHEN m.new_path IS NOT NULL
                   THEN jsonb_set(e.elem, '{showcase}', to_jsonb(m.new_path))
                   ELSE e.elem END
              ORDER BY e.ord)
       FROM jsonb_array_elements(d.data) WITH ORDINALITY AS e(elem, ord)
       LEFT JOIN (VALUES
         ('assets/products/showcase-gummies.jpg', 'assets/products/showcase-pulmoclear-v3.jpg'),
         ('assets/products/showcase-liver.jpg',   'assets/products/showcase-liver-v3.jpg'),
         ('assets/products/showcase-reviva.jpg',  'assets/products/showcase-reviva-v3.jpg'),
         ('assets/products/showcase-inhaler.jpg', 'assets/products/showcase-breathefree-v3.jpg')
       ) AS m(old_path, new_path) ON m.old_path = e.elem->>'showcase'
   )
 WHERE d.key = 'site.PRODUCTS' AND jsonb_typeof(d.data) = 'array'
