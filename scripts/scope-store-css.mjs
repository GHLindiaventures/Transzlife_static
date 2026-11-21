// Scopes the reference store's global CSS under `.tl-store` so it can live inside this site
// without touching (or being touched by) the site's own styles.
// usage: node scope-css.mjs <postcss path> <out file> <in files...>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const [, , postcssPath, out, ...inputs] = process.argv;
const postcss = createRequire(import.meta.url)(postcssPath);

const ROOT = '.tl-store, [data-radix-popper-content-wrapper]'; // tooltips are portalled to <body>
// Specificity ladder (the :not(#id) parts only add weight, they always match):
//   host site rules  <  reset (1 id)  <  store rules (2 ids, same relative order as the original)
const S = '.tl-store:not(#tl-a):not(#tl-b)';
const R = '.tl-store';
const W = ':not(#tl-r):not([data-slot], [data-slot] > *)'; // shadcn/ui parts keep their Tailwind classes

// classes this site also styles: wipe the site's declarations first, the store's own rules then apply
const CLASH = ['.btn', '.btn--sm', '.icon-btn', '.link-btn', '.crumbs', '.eyebrow', '.pcard', '.pcard__badge', '.pcard__media', '.glass', '.is-active', '.is-in', '.is-open', '.is-on'];
const ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'ul', 'ol', 'li', 'input', 'select', 'textarea', 'label', 'small', 'strong', 's', 'em', 'nav', 'section', 'aside', 'article', 'fieldset', 'legend', 'figure', 'blockquote'];
const reset = `/* ---- isolation from the host site's styles ---- */
${R} :is(${ELEMENTS.join(',')})${W}, ${R} :is(${CLASH.join(',')})${W} { all: revert; box-sizing: border-box; }
${R} :is(${CLASH.join(',')})${W}::before, ${R} :is(${CLASH.join(',')})${W}::after { content: none; }
`;

function scopeSelector(sel) {
  const s = sel.trim();
  if (s === ':root') return ROOT;
  if (/^(html|body)$/.test(s)) return S;
  if (/^(html|body)[:.[]/.test(s)) return s; // body:has(...) style state rules stay global
  if (/^(html|body)\s/.test(s)) return s.replace(/^(html|body)\s+/, `${S} `);
  if (/(^|[\s,>+~])\.tip\b/.test(s)) return s; // tooltip content lives outside the scope
  if (s.startsWith('*')) return `${S} ${s}`;
  return `${S} ${s}`;
}

let css = '';
for (const f of inputs) css += `\n/* ===== ${basename(f)} ===== */\n` + readFileSync(f, 'utf8');

const root = postcss.parse(css);
const names = new Set();
root.walkAtRules('keyframes', (r) => { names.add(r.params.trim()); r.params = `tl-${r.params.trim()}`; });
root.walkRules((rule) => {
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(scopeSelector);
});
root.walkDecls(/^animation(-name)?$/, (d) => {
  d.value = d.value.replace(/[A-Za-z_][\w-]*/g, (w) => (names.has(w) ? `tl-${w}` : w));
});

writeFileSync(out, `/* GENERATED from the TranzLife store project (main, home, enhance, mobile, mrange .css) plus pdp-plus.css,
   every rule scoped under .tl-store. Re-run scope-css.mjs instead of editing by hand. */\n` + reset + root.toString());
console.log('keyframes renamed:', [...names].join(' '));
