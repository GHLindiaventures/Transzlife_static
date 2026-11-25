-- The homepage gained a customer reviews section (main, 26d9a52) and hides "Our story" by default.
-- Keep the dashboard's homepage list in step. Statements are separated by "-- ;;" lines (see migrate.js).

UPDATE home_sections SET visible = false, updated_at = now() WHERE key = 'story'
-- ;;
INSERT INTO home_sections (key, sort) VALUES ('reviews', 120) ON CONFLICT (key) DO NOTHING
-- ;;
-- the ingredient library merged with main uses 'sesame-oil'; move CycleRelief over and hide the old entry
UPDATE products SET content = jsonb_set(content, '{ingredients}',
         (SELECT jsonb_agg(CASE WHEN x = 'sesame' THEN 'sesame-oil' ELSE x END) FROM jsonb_array_elements_text(content->'ingredients') x))
 WHERE content->'ingredients' ? 'sesame'
-- ;;
INSERT INTO ingredients (id, name, alt, latin, type, part, note, sort_order)
VALUES ('sesame-oil', 'Sesame Oil', 'Nallennai / Gingelly', 'Sesamum indicum', 'oil', 'Seed', 'The classic Ayurvedic massage base oil, valued for its nourishing feel on the skin.', 400)
ON CONFLICT (id) DO NOTHING
-- ;;
UPDATE ingredients SET active = false, updated_at = now() WHERE id = 'sesame'
