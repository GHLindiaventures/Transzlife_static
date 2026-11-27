import { useEffect } from 'react';

// Page <title> and meta description for every page (search results and browser tabs).
// The defaults are the ones in index.html, read once, so a page without its own text falls back to them.
const BRAND = 'TranzLife Biosciences';
let DEFAULT_TITLE = '';
let DEFAULT_DESC = '';
let DEFAULT_OG_IMG = '';

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

/**
 * usePageMeta('FAQs', 'Answers about...')  ->  "FAQs | TranzLife Biosciences" + description + canonical + OG/Twitter tags.
 * usePageMeta(null) -> the site defaults. Pass { exact: true } to use the title as given.
 */
export function usePageMeta(title, description, { exact = false, image = '', type = 'website', noindex = false, canonical = '' } = {}) {
  useEffect(() => {
    if (!DEFAULT_TITLE) {
      DEFAULT_TITLE = document.title;
      DEFAULT_DESC = document.querySelector('meta[name="description"]')?.content || '';
      DEFAULT_OG_IMG = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '/assets/share/og-home.jpg';
    }
    const fullTitle = title ? (exact ? title : `${title} | ${BRAND}`) : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;
    const url = `${window.location.origin}${window.location.pathname}`;
    const canon = canonical ? new URL(canonical, window.location.origin).href : url;
    const img = new URL(image || DEFAULT_OG_IMG, window.location.origin).href;

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
    else {
      const r = document.querySelector('meta[name="robots"]');
      if (r && r.content === 'noindex, nofollow') r.remove();
    }
  }, [title, description, exact, image, type, noindex, canonical]);
}
