// Builds the product-page gallery slides (1200×1200 WebP infographics) for every product.
//
//   node scripts/gallery/build-gallery.mjs              # all products
//   node scripts/gallery/build-gallery.mjs reviva-roll-on
//
// Each slide is an HTML page built from the product data, rendered by headless Microsoft Edge
// (or Chrome) through the DevTools protocol and saved straight to WebP — no extra npm packages.
// Output: public/img/gallery/<product-id>/<nn>-<slide>.webp and src/store/data/gallery.js.
// Set BROWSER=<path to chrome/edge> if the browser is not in a default location.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';
import { PRODUCTS } from '../../src/store/data/products.js';
import { getIngredient, getIngredientImg } from '../../src/store/data/ingredients.js';
import { SLIDE_COPY } from './content.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUB = join(ROOT, 'public');
const OUT = join(PUB, 'img/gallery');
const SIZE = 1200;

const asset = (p) => pathToFileURL(join(PUB, p.replace(/^\//, ''))).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (name, size = 34, stroke = 1.8) => {
  const I = Lucide[name];
  if (!I) throw new Error(`Unknown lucide icon: ${name}`);
  return renderToStaticMarkup(createElement(I, { size, strokeWidth: stroke }));
};
const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/)?.[0] || s).trim();
// "TranzLife Energy Booster™" -> "Energy Booster™" for big headlines
const shortName = (p) => p.name.replace(/^TranzLife\s+/, '');

/* ------------------------------------------------------------------ styles */
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${SIZE}px;height:${SIZE}px;overflow:hidden}
body{font-family:'Manrope',system-ui,sans-serif;color:#15281c;-webkit-font-smoothing:antialiased;
  --ink:#15281c;--muted:#53625a;--line:color-mix(in srgb,var(--a) 22%,transparent)}
.slide{position:relative;width:${SIZE}px;height:${SIZE}px;overflow:hidden;
  background:radial-gradient(120% 90% at 85% 40%,#fff 0%,var(--t) 55%,color-mix(in srgb,var(--t) 70%,var(--a) 12%) 100%)}
.serif{font-family:'Fraunces',Georgia,serif;font-optical-sizing:auto}
.brand{position:absolute;left:84px;bottom:56px;display:flex;align-items:center;gap:14px;z-index:3}
.brand img{width:54px;height:54px;object-fit:contain}
.brand span{font-weight:800;letter-spacing:.26em;font-size:15px;color:var(--a)}
.brand small{display:block;font-weight:600;letter-spacing:.32em;font-size:11px;color:var(--muted);margin-top:3px}
.note{position:absolute;right:64px;bottom:62px;max-width:430px;text-align:right;font-size:13px;line-height:1.45;color:var(--muted);z-index:3}
.eyebrow{display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border-radius:999px;background:var(--ink);color:#fff;
  font-weight:800;font-size:16px;letter-spacing:.16em;text-transform:uppercase}
.rule{display:flex;align-items:center;width:330px;margin:26px 0 30px}
.rule::before{content:'';flex:1;height:4px;border-radius:2px;background:var(--a)}
.rule::after{content:'';width:14px;height:14px;border-radius:50%;background:var(--a);margin-left:-2px}
.pack{position:absolute;mix-blend-mode:multiply;object-fit:contain;z-index:1}
.halo{position:absolute;border-radius:50%;background:radial-gradient(circle,#fff 0%,#fff 45%,rgba(255,255,255,0) 70%)}
.leafy{position:absolute;opacity:.10;color:var(--a)}
.bot{position:absolute;z-index:1;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#f7f3ea 70%,#ece4d2 100%);
  border:6px solid #fff;box-shadow:0 24px 50px color-mix(in srgb,var(--a) 22%,transparent);display:grid;place-items:center;overflow:hidden}
.bot img{width:82%;height:82%;object-fit:contain;mix-blend-mode:multiply}
.cover .ctext{position:absolute;left:0;right:0;top:86px;text-align:center;z-index:2}
.cover h1{font-size:120px;line-height:1;font-weight:700;letter-spacing:-.02em;margin-top:26px}
.cover .ctext p{font-size:30px;color:var(--muted);margin-top:14px}
.cover .soon{position:absolute;right:64px;bottom:56px;z-index:3;padding:12px 22px;border-radius:999px;border:2px dashed var(--a);
  color:var(--a);font-weight:800;font-size:20px;background:rgba(255,255,255,.7)}
.ithumb b{font-family:'Fraunces',serif;font-size:38px;color:#fff;width:100%;height:100%;display:grid;place-items:center;background:var(--a)}
.pcard{position:absolute;object-fit:cover;border-radius:40px;z-index:1;border:10px solid #fff;
  box-shadow:0 30px 70px color-mix(in srgb,var(--a) 28%,transparent),0 8px 20px rgba(0,0,0,.08)}

/* helps with */
.helps .copy{position:absolute;left:84px;top:86px;width:600px;z-index:2}
.helps h1{font-size:124px;line-height:.9;font-weight:700;letter-spacing:-.02em;color:var(--ink);margin-top:28px}
.list{list-style:none}
.list li{display:flex;align-items:center;gap:24px;padding:13px 0;border-bottom:2px solid var(--line)}
.list li:last-child{border-bottom:0}
.ic{flex:none;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--a);
  box-shadow:0 10px 24px color-mix(in srgb,var(--a) 35%,transparent),inset 0 0 0 5px rgba(255,255,255,.18)}
.list strong{font-size:29px;line-height:1.22;font-weight:700;color:var(--ink)}
.pill{display:inline-block;margin-top:22px;padding:14px 26px;border-radius:12px;background:var(--a);color:#fff;font-weight:800;font-size:25px}

/* ingredients */
.ings .copy{position:absolute;left:84px;top:86px;width:640px;z-index:2}
.ings h1{font-size:94px;line-height:.98;font-weight:700;letter-spacing:-.02em;margin-top:26px}
.ings h1 em{font-style:italic;color:var(--a);font-weight:600}
.irow{display:flex;align-items:center;gap:24px;padding:10px 0;border-bottom:2px solid var(--line)}
.irow:last-child{border-bottom:0}
.ithumb{flex:none;width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#f7f3ea 70%,#ece4d2 100%);
  border:3px solid #fff;box-shadow:0 8px 22px rgba(20,40,28,.14);overflow:hidden;display:grid;place-items:center}
.ithumb img{width:88%;height:88%;object-fit:contain;mix-blend-mode:multiply}
.irow strong{display:block;font-size:29px;font-weight:800;line-height:1.15}
.irow small{display:block;font-size:21px;color:var(--muted);margin-top:4px;line-height:1.3}
.ings.few .irow{align-items:flex-start;padding:24px 0}
.ings.few .ithumb{width:150px;height:150px}
.ings.few .irow small{font-size:23px;max-width:440px}
.more{display:inline-flex;align-items:center;gap:10px;margin-top:14px;padding:13px 24px;border-radius:999px;border:2px dashed var(--a);color:var(--a);font-weight:800;font-size:22px;background:rgba(255,255,255,.6)}

/* made for */
.made .copy{position:absolute;left:84px;top:86px;width:570px;z-index:2}
.made h1{font-size:74px;line-height:1.02;font-weight:700;letter-spacing:-.02em;margin-top:26px}
.cards{display:grid;gap:16px}
.card{display:flex;align-items:center;gap:20px;padding:22px 26px;border-radius:22px;background:rgba(255,255,255,.82);
  box-shadow:0 10px 30px rgba(20,40,28,.08);border:1px solid rgba(255,255,255,.9)}
.card .tick{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:var(--a);color:#fff}
.card strong{font-size:25px;line-height:1.28;font-weight:700}
.illu{position:absolute;left:670px;top:330px;width:500px;height:500px;object-fit:contain;mix-blend-mode:multiply;z-index:1}

/* how to use */
.how .copy{position:absolute;left:84px;top:86px;width:660px;z-index:2}
.how h1{font-size:96px;line-height:.98;font-weight:700;letter-spacing:-.02em;margin-top:26px}
.how h1 em{font-style:italic;color:var(--a);font-weight:600}
.steps{display:grid;gap:18px}
.step{display:flex;gap:26px;align-items:flex-start;padding:26px 28px;border-radius:24px;background:rgba(255,255,255,.85);box-shadow:0 10px 30px rgba(20,40,28,.08)}
.step b{flex:none;font-family:'Fraunces',serif;font-size:58px;line-height:.9;font-weight:700;color:var(--a);width:76px}
.step span{font-size:27px;line-height:1.35;font-weight:600;padding-top:4px}
.routine{position:absolute;left:84px;right:84px;bottom:150px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;z-index:2}
.rchip{display:flex;align-items:center;gap:18px;padding:20px 24px;border-radius:20px;background:var(--a);color:#fff}
.rchip .ric{flex:none;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18)}
.rchip small{display:block;font-size:15px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.8}
.rchip strong{display:block;font-size:24px;line-height:1.2;font-weight:700;margin-top:2px}

/* trust */
.trust{background:radial-gradient(110% 80% at 80% 0%,color-mix(in srgb,var(--a) 70%,#fff 8%) 0%,color-mix(in srgb,var(--a) 55%,#0b1a10) 70%);color:#fff}
.trust .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.16;mix-blend-mode:luminosity}
.trust .copy{position:absolute;left:84px;right:84px;top:86px;z-index:2}
.trust .eyebrow{background:#fff;color:var(--a)}
.trust h1{font-size:104px;line-height:.98;font-weight:700;letter-spacing:-.02em;margin-top:26px;color:#fff}
.trust h1 em{font-style:italic;font-weight:500;color:color-mix(in srgb,var(--t) 80%,#fff)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:48px}
.tile{display:flex;gap:22px;align-items:flex-start;padding:30px 30px;border-radius:26px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(6px)}
.tile .ic{background:#fff;color:var(--a);box-shadow:none;width:70px;height:70px}
.tile strong{display:block;font-size:29px;line-height:1.15;font-weight:800}
.tile small{display:block;font-size:20px;line-height:1.4;opacity:.85;margin-top:8px}
.badges{position:absolute;left:84px;right:84px;bottom:150px;display:grid;grid-template-columns:repeat(6,1fr);gap:16px;z-index:2}
.badges span{height:112px;border-radius:20px;background:#fff;display:grid;place-items:center;padding:14px}
.badges img{max-width:100%;max-height:84px;object-fit:contain}
.trust .brand span{color:#fff}.trust .brand small{color:rgba(255,255,255,.75)}
.trust .brand img{background:#fff;border-radius:50%;padding:4px}
.trust .note{color:rgba(255,255,255,.75)}
`;

const DISCLAIMER = 'Wellness support only. Not intended to diagnose, treat, cure or prevent any disease.';

const brand = () => `<div class="brand"><img src="${asset('img/brand/emblem.webp')}" alt=""><div><span>TRANZLIFE</span><small>BIOSCIENCES</small></div></div>`;
const LEAF_SVG = (x, y, s, r) => `<svg class="leafy" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;transform:rotate(${r}deg)" viewBox="0 0 24 24" fill="currentColor"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>`;

// Pack shot on a white halo; or, for products whose pack shot is white or not on a white
// background (`card: true` in content.mjs), the lifestyle photo in a framed card.
function art(p, c, x, y, w, h) {
  if (c.botanicals) return botanicals(c.botanicals, x, y, w, h);
  if (c.card) {
    const cw = Math.round(w * 0.9), ch = Math.round(h * 0.86);
    return `<img class="pcard" src="${asset(c.photo)}" style="left:${x + (w - cw) / 2}px;top:${y + (h - ch) / 2}px;width:${cw}px;height:${ch}px" alt="">`;
  }
  const d = Math.max(w, h) * 1.1;
  return `<div class="halo" style="left:${x + w / 2 - d / 2}px;top:${y + h / 2 - d / 2}px;width:${d}px;height:${d}px"></div>`
    + `<img class="pack" src="${asset(p.images[0])}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" alt="">`;
}

// For a product with no pack photo yet: a cluster of its ingredient cutouts on a white halo.
function botanicals(ids, x, y, w, h) {
  const d = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const big = d * 0.5, small = d * 0.34;
  const spots = [[0, -0.2, big], [-0.27, 0.17, small], [0.27, 0.17, small], [0, 0.33, small * 0.8]];
  const halo = `<div class="halo" style="left:${cx - d * 0.62}px;top:${cy - d * 0.62}px;width:${d * 1.24}px;height:${d * 1.24}px"></div>`;
  return halo + ids.slice(0, spots.length).map((id, k) => {
    const [dx, dy, s] = spots[k];
    return `<span class="bot" style="left:${cx + dx * d - s / 2}px;top:${cy + dy * d - s / 2}px;width:${s}px;height:${s}px"><img src="${asset(getIngredientImg(id))}" alt=""></span>`;
  }).join('');
}

// Cover image for a product whose pack photo is not available yet. Says so on the image.
function slideCover(p, c) {
  return page(p, 'cover', `
    ${LEAF_SVG(980, 40, 200, 30)}${LEAF_SVG(60, 900, 150, -40)}
    ${botanicals(c.botanicals, 300, 330, 600, 560)}
    <div class="ctext">
      <span class="eyebrow">${esc(p.format)} · ${esc(p.size)}</span>
      <h1 class="serif">${esc(shortName(p).replace(/\s*Respiratory Wellness Drops$/, ''))}</h1>
      <p>${esc(p.tagline)}</p>
    </div>
    <span class="soon">Product photo coming soon</span>
    ${brand()}`);
}

function page(p, cls, body) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Manrope:wght@500;600;700;800&display=block" rel="stylesheet">
<style>${CSS}</style></head>
<body style="--a:${p.accent};--t:${p.tint}"><div class="slide ${cls}">${body}</div></body></html>`;
}

/* ------------------------------------------------------------------ slides */
function slideHelps(p, c) {
  const items = c.helps.map(([ic, text]) => `<li><span class="ic">${icon(ic)}</span><strong>${esc(text)}</strong></li>`).join('');
  return page(p, 'helps', `
    ${LEAF_SVG(980, 40, 200, 30)}${LEAF_SVG(640, 900, 140, -40)}
    ${art(p, c, 700, 250, 500, 760)}
    <div class="copy">
      <span class="eyebrow">${esc(shortName(p))}</span>
      <h1 class="serif">Helps<br>with</h1>
      <div class="rule"></div>
      <ul class="list">${items}</ul>
      <span class="pill">${esc(c.pill)}</span>
    </div>
    ${brand()}<p class="note">*${DISCLAIMER}</p>`);
}

function slideIngredients(p, c) {
  const ings = p.ingredients.map(getIngredient).filter(Boolean);
  const few = ings.length <= 3;
  const shown = ings.slice(0, few ? 3 : 5);
  const rows = shown.map((g) => {
    const sub = few ? g.note.split(/(?<=\.)\s+/).slice(0, 2).join(' ') : [g.alt, g.part].filter(Boolean).join(' · ') || g.latin;
    const img = getIngredientImg(g.id);
    const thumb = existsSync(join(PUB, img)) ? `<img src="${asset(img)}" alt="">` : `<b>${esc(g.name[0])}</b>`;
    return `<div class="irow"><span class="ithumb">${thumb}</span>
      <div><strong>${esc(g.name)}</strong><small>${esc(sub)}</small></div></div>`;
  }).join('');
  const rest = ings.length - shown.length;
  return page(p, `ings${few ? ' few' : ''}`, `
    ${LEAF_SVG(1000, 30, 180, 20)}
    ${art(p, c, 740, 300, 470, 700)}
    <div class="copy">
      <span class="eyebrow">Key ingredients</span>
      <h1 class="serif">Powered by<br><em>nature.</em></h1>
      <div class="rule"></div>
      ${rows}
      ${rest > 0 ? `<span class="more">${icon('Plus', 22, 2.4)} ${rest} more ingredients</span>` : ''}
    </div>
    ${brand()}`);
}

function slideMadeFor(p, c) {
  const cards = p.whoFor.slice(0, 4).map((w) => `<div class="card"><span class="tick">${icon('Check', 26, 3)}</span><strong>${esc(w)}</strong></div>`).join('');
  const visual = !c.illustration ? art(p, c, 700, 300, 460, 680)
    : c.illustrationPhoto ? `<img class="pcard" src="${asset(c.illustration)}" style="left:690px;top:290px;width:440px;height:640px" alt="">`
      : `<div class="halo" style="left:560px;top:220px;width:760px;height:760px"></div><img class="illu" src="${asset(c.illustration)}" alt="">`;
  return page(p, 'made', `
    ${LEAF_SVG(1010, 50, 170, 50)}
    ${visual}
    <div class="copy">
      <span class="eyebrow">Who it’s for</span>
      <h1 class="serif">${esc(c.madeForTitle)}</h1>
      <div class="rule"></div>
      <div class="cards">${cards}</div>
    </div>
    ${brand()}<p class="note">*${DISCLAIMER}</p>`);
}

const ROUTINE_ICON = { Dose: 'Pill', When: 'Clock', Format: 'Package', Pack: 'Package', Tip: 'Lightbulb', How: 'Hand', Use: 'Hand', Apply: 'Hand', Carry: 'Briefcase', Where: 'MapPin' };
function slideHow(p, c) {
  const steps = p.howToUse.slice(0, 3).map((s, i) => `<div class="step"><b>0${i + 1}</b><span>${esc(s)}</span></div>`).join('');
  const chips = p.routine.slice(0, 3).map((r) => `<div class="rchip"><span class="ric">${icon(ROUTINE_ICON[r.label] || 'Sparkles', 28)}</span><div><small>${esc(r.label)}</small><strong>${esc(r.value)}</strong></div></div>`).join('');
  return page(p, 'how', `
    ${LEAF_SVG(1010, 40, 160, -20)}
    ${art(p, c, 790, 170, 390, 540)}
    <div class="copy">
      <span class="eyebrow">How to use</span>
      <h1 class="serif">A simple<br><em>daily ritual</em></h1>
      <div class="rule"></div>
      <div class="steps">${steps}</div>
    </div>
    <div class="routine">${chips}</div>
    ${brand()}`);
}

function slideTrust(p, c) {
  const tiles = [
    ['Leaf', 'Plant-based', 'Botanicals from traditional Indian knowledge'],
    ['FlaskConical', 'AYUSH GMP', 'Class 10,000 (ISO 7) cleanroom manufacturing'],
    ['BadgeCheck', 'ISO 9001:2015', 'Quality-checked from sourcing to pack'],
    ['MapPin', 'Made in India', 'Formulated by TranzLife, Chennai'],
  ].map(([ic, t, s]) => `<div class="tile"><span class="ic">${icon(ic, 32)}</span><div><strong>${t}</strong><small>${s}</small></div></div>`).join('');
  const badges = ['ayush.png', 'fssai.png', 'make-in-india.png', 'msme.png', 'dpiit-startup-india.png', 'gem-gov.png']
    .map((b) => `<span><img src="${asset('assets/badges/' + b)}" alt=""></span>`).join('');
  return page(p, 'trust', `
    ${c.photo ? `<img class="bg" src="${asset(c.photo)}" alt="">` : ''}
    <div class="copy">
      <span class="eyebrow">THE LIVING SCIENCE.</span>
      <h1 class="serif">Purity you can trust,<br><em>in every pack.</em></h1>
      <div class="tiles">${tiles}</div>
    </div>
    <div class="badges">${badges}</div>
    ${brand()}<p class="note">Recognised &amp; certified</p>`);
}

const SLIDES = [
  ['helps', slideHelps],
  ['ingredients', slideIngredients],
  ['made-for', slideMadeFor],
  ['how-to-use', slideHow],
  ['why-tranzlife', slideTrust],
];

/* ------------------------------------------------------------------ browser (DevTools protocol) */
function findBrowser() {
  const c = [process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'].filter(Boolean);
  const hit = c.find((x) => existsSync(x));
  if (!hit) throw new Error('No Chrome/Edge found. Set BROWSER=<path>.');
  return hit;
}

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'tl-gallery-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(findBrowser(), [`--headless=new`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--allow-file-access-from-files', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const { r, j } = wait.get(d.id); wait.delete(d.id); d.error ? j(new Error(d.error.message)) : r(d.result); } };
  const send = (method, params = {}) => new Promise((r, j) => { const n = ++id; wait.set(n, { r, j }); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: SIZE, height: SIZE, deviceScaleFactor: 1, mobile: false });
  const close = () => { ws.close(); proc.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 800); };
  return { send, close };
}

async function render(b, html, file) {
  const tmp = join(OUT, '.tmp.html');
  writeFileSync(tmp, html);
  await b.send('Page.navigate', { url: pathToFileURL(tmp).href });
  // wait for fonts + every image
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const { result } = await b.send('Runtime.evaluate', {
      expression: `document.readyState==='complete' && document.fonts.status==='loaded' && [...document.images].every(i=>i.complete)`,
      returnByValue: true,
    });
    if (result.value) break;
  }
  await new Promise((r) => setTimeout(r, 200));
  const { data } = await b.send('Page.captureScreenshot', { format: 'webp', quality: 86, clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 } });
  writeFileSync(file, Buffer.from(data, 'base64'));
}

/* ------------------------------------------------------------------ main */
const only = process.argv.slice(2);
const list = PRODUCTS.filter((p) => !only.length || only.includes(p.id));
mkdirSync(OUT, { recursive: true });
const b = await launch();
const manifest = {};
try {
  for (const p of list) {
    const c = SLIDE_COPY[p.id];
    if (!c) { console.warn(`skip ${p.id}: no copy in content.mjs`); continue; }
    const dir = join(OUT, p.id);
    mkdirSync(dir, { recursive: true });
    const urls = [];
    if (c.cover) {
      // stands in for the pack shot (p.images[0] points here) until the real photo arrives
      await render(b, slideCover(p, c), join(dir, '00-pack.webp'));
      console.log(`  ${p.id}/00-pack.webp`);
    }
    for (const [n, [slug, fn]] of SLIDES.entries()) {
      const name = `${String(n + 1).padStart(2, '0')}-${slug}.webp`;
      await render(b, fn(p, c), join(dir, name));
      urls.push(`/img/gallery/${p.id}/${name}`);
      console.log(`  ${p.id}/${name}`);
    }
    manifest[p.id] = urls;
  }
} finally {
  b.close();
  rmSync(join(OUT, '.tmp.html'), { force: true });
}

// Gallery order on the product page: lifestyle photo, infographics, then the plain pack shots.
if (!only.length) {
  const order = Object.fromEntries(PRODUCTS.filter((p) => manifest[p.id]).map((p) => {
    const [helps, ...rest] = manifest[p.id];
    const photo = SLIDE_COPY[p.id].photo;
    return [p.id, photo ? ['/' + photo, helps, ...p.images, ...rest] : [...p.images, helps, ...rest]];
  }));
  writeFileSync(join(ROOT, 'src/store/data/gallery.js'),
    `// Product-page gallery images, generated by scripts/gallery/build-gallery.mjs. Do not edit by hand:\n` +
    `// change the product data or scripts/gallery/content.mjs and re-run the script.\n` +
    `export const GALLERY = ${JSON.stringify(order, null, 2)};\n\n` +
    `export const getGallery = (p) => GALLERY[p.id] || p.images;\n`);
  console.log('wrote src/store/data/gallery.js');
}
