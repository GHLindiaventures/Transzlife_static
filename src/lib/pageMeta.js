import { useEffect } from 'react';

// Page <title> and meta description for every page (search results and browser tabs).
// The defaults are the ones in index.html, read once, so a page without its own text falls back to them.
const BRAND = 'TranzLife Biosciences';
let DEFAULT_TITLE = '';
let DEFAULT_DESC = '';

function descTag() {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) { tag = document.createElement('meta'); tag.name = 'description'; document.head.appendChild(tag); }
  return tag;
}

/**
 * usePageMeta('FAQs', 'Answers about...')  ->  "FAQs | TranzLife Biosciences" + that description.
 * usePageMeta(null) -> the site defaults. Pass { exact: true } to use the title as given.
 */
export function usePageMeta(title, description, { exact = false } = {}) {
  useEffect(() => {
    if (!DEFAULT_TITLE) { DEFAULT_TITLE = document.title; DEFAULT_DESC = descTag().content; }
    document.title = title ? (exact ? title : `${title} | ${BRAND}`) : DEFAULT_TITLE;
    descTag().content = description || DEFAULT_DESC;
  }, [title, description, exact]);
}
