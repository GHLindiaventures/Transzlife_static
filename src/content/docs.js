// Loads the website's text from the database (GET /api/content) and writes it into the content objects the pages
// import (src/content/registry.js lists them). Runs once before the site is shown, so no page ever renders anything
// that is not from the database. If the API cannot be reached the site shows a retry screen, not stale text.
import { DOCS, rebuildDerived } from './registry.js';

function fill(target, data) {
  if (Array.isArray(target)) { if (Array.isArray(data)) target.splice(0, target.length, ...data); return; }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, data);
  }
}

export async function loadSiteDocs() {
  const res = await fetch('/api/content', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`content ${res.status}`);
  const { docs } = await res.json();
  const missing = [];
  for (const [key, { target }] of Object.entries(DOCS)) {
    if (docs[key] === undefined) { missing.push(key); continue; }
    fill(target, docs[key]);
  }
  if (missing.length) throw new Error(`content missing: ${missing.join(', ')}`);
  rebuildDerived();
}
