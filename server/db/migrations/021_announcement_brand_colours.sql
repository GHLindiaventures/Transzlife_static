-- Announcement bar: back to the brand colours (green background, gold text). The bar loaded green and then
-- switched to the black/white saved in the dashboard; the site now always uses the brand colours, and only
-- the speed is editable. Keeps whatever speed was chosen.
UPDATE settings
   SET value = jsonb_build_object('bg', '#124a2c', 'fg', '#efc04a', 'speed', COALESCE(value->>'speed', 'normal'))
 WHERE key = 'announcement_style'
