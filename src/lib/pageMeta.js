import { useEffect } from 'react';

// Page <title>, description, canonical and share tags for every page (search results, browser tabs, link previews).
// Blog pages also arrive with tags written by the server (server/cms/seo-html.js) for crawlers that do not run
// JavaScript; once the visitor moves to another page, the server's page-specific extras are removed here.
const BRAND = 'TranzLife Biosciences';
// the site-wide defaults, as in index.html (not read from the page: a blog page arrives with its own tags)
const DEFAULT_TITLE = 'TranzLife Biosciences | Ayurvedic, Plant-Based Wellness from Chennai';
const DEFAULT_DESC = 'TranzLife Biosciences makes Ayurvedic, plant-based wellness products for lung care, quitting smoking, period comfort, liver care and everyday vitality, standardised with modern science.';
const DEFAULT_OG_IMG = '/assets/share/og-home.jpg';
const FIRST_PATH = typeof window !== 'undefined' ? window.location.pathname : '';

function metaTag(attr, key, content) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function canonicalTag(href) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = 'canonical';
    document.head.appendChild(tag);
  }
  tag.href = href;
}

/** The server's page-specific extras (structured data, article dates, image alt) belong to the first page only. */
function dropServerExtras() {
  if (window.location.pathname === FIRST_PATH) return;
  document.querySelectorAll('script[data-ssr-ld], meta[property^="article:"], meta[property="og:image:alt"], meta[name="twitter:image:alt"]')
    .forEach((el) => el.remove());
}

/**
 * usePageMeta('FAQs', 'Answers about...')  ->  "FAQs | TranzLife Biosciences" + description + canonical + OG/Twitter tags.
 * usePageMeta(null) -> the site defaults. Pass { exact: true } to use the title as given.
 */
export function usePageMeta(title, description, { exact = false, image = '', type = 'website', noindex = false, canonical = '' } = {}) {
  useEffect(() => {
    const fullTitle = title ? (exact ? title : `${title} | ${BRAND}`) : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;
    const url = `${window.location.origin}${window.location.pathname}`;
    const canon = canonical ? new URL(canonical, window.location.origin).href : url;
    const img = new URL(image || DEFAULT_OG_IMG, window.location.origin).href;

    dropServerExtras();
    document.title = fullTitle;
    metaTag('name', 'description', desc);
    canonicalTag(canon);
    metaTag('property', 'og:type', type);
    metaTag('property', 'og:title', fullTitle);
    metaTag('property', 'og:description', desc);
    metaTag('property', 'og:url', canon);
    metaTag('property', 'og:image', img);
    metaTag('name', 'twitter:card', 'summary_large_image');
    metaTag('name', 'twitter:title', fullTitle);
    metaTag('name', 'twitter:description', desc);
    metaTag('name', 'twitter:image', img);
    if (noindex) metaTag('name', 'robots', 'noindex, nofollow');
    else if (window.location.pathname !== FIRST_PATH || !document.querySelector('script[data-ssr-ld]')) {
      // a "noindex" from an earlier page (or the server's tags for it) must not stick to this one
      document.querySelector('meta[name="robots"]')?.remove();
    }
  }, [title, description, exact, image, type, noindex, canonical]);
}
