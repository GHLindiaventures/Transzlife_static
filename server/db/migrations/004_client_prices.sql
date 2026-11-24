-- Client's approved MRPs (24 Nov 2026). Products are sold at MRP (price = mrp).
-- BreatheFree inhaler is not in the client's list and keeps its placeholder price.
-- On a brand-new database this changes nothing (products are seeded afterwards from
-- src/store/data/products.js, which already has these prices).
-- Statements are separated by "-- ;;" lines (see migrate.js).

INSERT INTO audit_log (staff_email, action, entity, entity_id, before, after)
SELECT 'migration 004 (client prices)', 'product.update', 'product', p.id,
       jsonb_build_object('price', p.price, 'mrp', p.mrp, 'size', p.size),
       jsonb_build_object('price', v.price, 'mrp', v.price, 'size', v.size)
  FROM products p
  JOIN (VALUES
    ('energy-booster',      185000, '500 ml'),
    ('pulmoclear-gummies',   20000, '30 Gummies'),
    ('liver-booster',        90000, '500 ml'),
    ('reviva-roll-on',       69900, '50 ml'),
    ('cyclerelief-roll-on',  29900, '8 ml')
  ) AS v(id, price, size) ON v.id = p.id
-- ;;
UPDATE products p
   SET price = v.price, mrp = v.price, size = v.size, updated_at = now()
  FROM (VALUES
    ('energy-booster',      185000, '500 ml'),
    ('pulmoclear-gummies',   20000, '30 Gummies'),
    ('liver-booster',        90000, '500 ml'),
    ('reviva-roll-on',       69900, '50 ml'),
    ('cyclerelief-roll-on',  29900, '8 ml')
  ) AS v(id, price, size)
 WHERE v.id = p.id
