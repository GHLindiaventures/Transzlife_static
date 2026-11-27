// The website's text content lives in the database (table site_docs, served by GET /api/content).
// Blog articles are not here: they live in the blog CMS (cms_posts, /api/blog/*, Blog in the dashboard).
// This file lists every content document and which code object it fills.
//   server: the objects below are the STARTING copy; any document missing from the database is created from them once.
//   browser: at start-up the database copy is written into these same objects in place (src/content/docs.js), so every
//            page reads database content. Staff edit it in the dashboard (Website content > Site text).
import * as site from './site.js';
import { SITE, ANNOUNCEMENTS, CERTIFICATIONS } from '../store/data/site.js';
import { CONCERNS } from '../store/data/concerns.js';
import { POLICIES } from '../store/data/policies.js';

/** key -> { target, label, group } */
export const DOCS = {
  'site.BRAND': { target: site.BRAND, label: 'Brand details', group: 'Site' },
  'site.PRODUCTS': { target: site.PRODUCTS, label: 'Product showcase list (menu, hero, slider)', group: 'Site' },
  'site.STORE_ID': { target: site.STORE_ID, label: 'Product link map', group: 'Site' },
  'site.ANNOUNCEMENTS': { target: site.ANNOUNCEMENTS, label: 'Announcement fallback text', group: 'Site' },
  'site.HERO': { target: site.HERO, label: 'Home hero', group: 'Home' },
  'site.RICH': { target: site.RICH, label: 'Home introduction', group: 'Home' },
  'site.PRODUCTS_SECTION': { target: site.PRODUCTS_SECTION, label: 'Home products heading', group: 'Home' },
  'site.PRODUCTS_PAGE': { target: site.PRODUCTS_PAGE, label: 'Products page heading', group: 'Home' },
  'site.BANNER': { target: site.BANNER, label: 'Home banner', group: 'Home' },
  'site.COMPARE_INTRO': { target: site.COMPARE_INTRO, label: 'Before / after intro', group: 'Home' },
  'site.BENEFITS': { target: site.BENEFITS, label: 'Benefits ("The TranzLife Difference")', group: 'Home' },
  'site.REELS': { target: site.REELS, label: 'Reels heading', group: 'Home' },
  'site.STRIP': { target: site.STRIP, label: 'Trust strip', group: 'Home' },
  'site.STORY_BLOCK': { target: site.STORY_BLOCK, label: 'Story block', group: 'Home' },
  'site.SCENES': { target: site.SCENES, label: 'Scroll scenes', group: 'Home' },
  'site.BRANDS': { target: site.BRANDS, label: 'Recognition logos', group: 'Home' },
  'site.BGVIDEO': { target: site.BGVIDEO, label: 'Cleanroom banner', group: 'Home' },
  'site.NEWSLETTER': { target: site.NEWSLETTER, label: 'Newsletter sign-up', group: 'Home' },
  'site.HELP_CTA': { target: site.HELP_CTA, label: 'Talk to our wellness team', group: 'Home' },
  'site.SHOWCASE': { target: site.SHOWCASE, label: 'Product showcase slider', group: 'Home' },
  'site.ABOUT': { target: site.ABOUT, label: 'About page', group: 'Pages' },
  'site.MILESTONES': { target: site.MILESTONES, label: 'Milestones', group: 'Pages' },
  'site.SCIENCE': { target: site.SCIENCE, label: 'Science page', group: 'Pages' },
  'site.FAQ': { target: site.FAQ, label: 'FAQ page', group: 'Pages' },
  'site.CONTACT': { target: site.CONTACT, label: 'Contact page', group: 'Pages' },
  'site.FOOTER': { target: site.FOOTER, label: 'Footer', group: 'Site' },
  'site.SOCIAL_LINKS': { target: site.SOCIAL_LINKS, label: 'Social links', group: 'Site' },
  'store.SITE': { target: SITE, label: 'Business details (phone, email, address)', group: 'Site' },
  'store.ANNOUNCEMENTS': { target: ANNOUNCEMENTS, label: 'Store announcements (fallback)', group: 'Site' },
  'store.CERTIFICATIONS': { target: CERTIFICATIONS, label: 'Certifications', group: 'Site' },
  concerns: { target: CONCERNS, label: 'Health concerns pages', group: 'Content' },
  policies: { target: POLICIES, label: 'Policy pages (shipping, privacy, terms)', group: 'Content' },
};

/** Lists that other code derives from site.PRODUCTS at load time; rebuilt after the database copy is applied. */
export function rebuildDerived() {
  site.NAV_COLLECTIONS.splice(0, site.NAV_COLLECTIONS.length, ...site.PRODUCTS.map((p) => p.short));
  site.NAV_PRODUCTS.splice(0, site.NAV_PRODUCTS.length, ...site.PRODUCTS.map((p) => ({ id: p.id, name: p.short })));
}
