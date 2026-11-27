// Website content managed from the dashboard (admin side: server/admin/content.js).
//   GET /api/site-content   announcement bar (messages + colours) and homepage sections
// Messages may contain {free_shipping} and {prepaid}, filled from the live shop settings so the bar
// can never promise a different free-shipping amount from the one checkout applies.
import { loadSettings } from './pricing.js';

export const SECTION_KEYS = ['rich', 'products', 'sep', 'banner', 'benefits', 'formulations', 'strip', 'story', 'video', 'brands', 'help', 'reviews'];
export const PRODUCT_SECTIONS = ['products', 'formulations'];

/** WCAG contrast ratio of two #rrggbb colours (4.5 or more is readable small text). */
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export function fillTokens(text, settings) {
  const free = `₹${Math.round((settings.free_shipping_above || 0) / 100).toLocaleString('en-IN')}`;
  const prepaid = `${Number(settings.prepaid_discount_pct || 0)}%`;
  return text.replaceAll('{free_shipping}', free).replaceAll('{prepaid}', prepaid);
}

export async function loadSiteContent(q) {
  const settings = await loadSettings(q);
  const messages = (await q(`SELECT text, link_url FROM announcements
                              WHERE active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
                              ORDER BY sort, created_at`)).rows
    // a prepaid message makes no sense with a 0% prepaid discount
    .filter((m) => !(m.text.includes('{prepaid}') && !Number(settings.prepaid_discount_pct)))
    .map((m) => ({ text: fillTokens(m.text, settings), href: m.link_url || null }));
  const style = settings.announcement_style || { bg: '#124a2c', fg: '#efc04a', speed: 'normal' };
  const sections = (await q('SELECT key, title, subtitle, product_ids, visible FROM home_sections ORDER BY sort, key')).rows
    .map((s) => ({ key: s.key, title: s.title || null, subtitle: s.subtitle || null, productIds: s.product_ids, visible: s.visible }));
  return {
    announcement: { messages, ...style },
    home: { sections },
    marketing: settings.marketing_tags || {},
    socialLinks: Array.isArray(settings.social_links) ? settings.social_links : [],
  };
}

export default async function contentRoutes(app, { db }) {
  app.get('/api/site-content', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache');                // staff changes show immediately
    return loadSiteContent(db.query);
  });
}
