-- Launch prices (26 Nov 2026, requested by the owner): the MRP is the real price printed on the pack
-- and is shown struck through; customers pay a selling price 5 to 10% below it, shown as "% off".
-- BreatheFree inhaler: its MRP was a ₹299 placeholder (an inflated "was" price); the real price is ₹249.
-- Prices stay editable afterwards in the dashboard (Pricing & offers). All amounts in paise.
-- On a brand-new database this changes nothing (products are seeded after migrations).
-- Statements are separated by "-- ;;" lines (see migrate.js).

INSERT INTO audit_log (staff_email, action, entity, entity_id, before, after)
SELECT 'migration 019 (launch prices)', 'product.update', 'product', p.id,
       jsonb_build_object('price', p.price, 'mrp', p.mrp),
       jsonb_build_object('price', v.price, 'mrp', v.mrp)
  FROM products p
  JOIN (VALUES
    ('energy-booster',      169900, 185000),
    ('pulmoclear-gummies',   18900,  20000),
    ('liver-booster',        84900,  90000),
    ('reviva-roll-on',       64900,  69900),
    ('cyclerelief-roll-on',  27900,  29900),
    ('breathefree-inhaler',  22900,  24900)
  ) AS v(id, price, mrp) ON v.id = p.id
-- ;;
UPDATE products p
   SET price = v.price, mrp = v.mrp, updated_at = now()
  FROM (VALUES
    ('energy-booster',      169900, 185000),
    ('pulmoclear-gummies',   18900,  20000),
    ('liver-booster',        84900,  90000),
    ('reviva-roll-on',       64900,  69900),
    ('cyclerelief-roll-on',  27900,  29900),
    ('breathefree-inhaler',  22900,  24900)
  ) AS v(id, price, mrp)
 WHERE v.id = p.id
