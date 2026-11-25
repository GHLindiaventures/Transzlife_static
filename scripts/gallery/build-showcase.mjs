// Builds the home-page images for BreathFree Drops from its pack photo:
//   public/assets/product-7.png               transparent cut-out (menu, drawer, mega menu)
//   public/assets/products/showcase-drops.jpg 1024×1024 lifestyle scene matching the other showcase shots
//
//   node scripts/gallery/build-showcase.mjs
//
// The pack photo is on white, so the cut-out is made by flood-filling the near-white background
// from the image edges (in a headless Edge/Chrome canvas). The scene reuses the site's own photos:
// a heavily blurred showcase shot for the sunlit backdrop, the wooden stump from the same shot as the
// podium, and the transparent mint / tulsi cut-outs as foreground leaves.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUB = join(ROOT, 'public');
const SRC = join(PUB, 'img/p/breathfree-drops.jpg');
const asset = (p) => pathToFileURL(join(PUB, p)).href;

function findBrowser() {
  const c = [process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const hit = c.find((x) => existsSync(x));
  if (!hit) throw new Error('No Chrome/Edge found. Set BROWSER=<path>.');
  return hit;
}

async function launch(size) {
  const profile = mkdtempSync(join(tmpdir(), 'tl-showcase-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--allow-file-access-from-files', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ }
  }
  if (!target) throw new Error('Browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const { r, j } = wait.get(d.id); wait.delete(d.id); d.error ? j(new Error(d.error.message)) : r(d.result); } };
  const send = (method, params = {}) => new Promise((r, j) => { const n = ++id; wait.set(n, { r, j }); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  return { send, close: () => { ws.close(); proc.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 800); } };
}

async function open(b, html) {
  const tmp = join(PUB, '.showcase-tmp.html');
  writeFileSync(tmp, html);
  await b.send('Page.navigate', { url: pathToFileURL(tmp).href });
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const { result } = await b.send('Runtime.evaluate', { expression: `document.readyState==='complete' && [...document.images].every(i=>i.complete) && window.__ready !== false`, returnByValue: true });
    if (result.value) break;
  }
  return tmp;
}

/* ---------- 1. transparent cut-out ---------- */
const CUT_HTML = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<img id="src" src="${pathToFileURL(SRC).href}">
<script>
window.__ready = false;
document.getElementById('src').onload = () => {
  const im = document.getElementById('src');
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, w, h); const px = d.data;
  // background = near-white, low-saturation pixels connected to the border
  const isBg = (i) => { const r = px[i], g = px[i + 1], b = px[i + 2]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mn > 222 && mx - mn < 18; };
  const seen = new Uint8Array(w * h); const stack = [];
  for (let i = 0; i < w; i++) { stack.push(i, (h - 1) * w + i); }
  for (let j = 0; j < h; j++) { stack.push(j * w, j * w + w - 1); }
  while (stack.length) {
    const p = stack.pop(); if (seen[p]) continue; seen[p] = 1;
    if (!isBg(p * 4)) continue;
    px[p * 4 + 3] = 0;
    const xx = p % w, yy = (p / w) | 0;
    if (xx > 0) stack.push(p - 1); if (xx < w - 1) stack.push(p + 1);
    if (yy > 0) stack.push(p - w); if (yy < h - 1) stack.push(p + w);
  }
  // soften the 1-px fringe next to removed pixels
  const a = new Uint8ClampedArray(w * h); for (let p = 0; p < w * h; p++) a[p] = px[p * 4 + 3];
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
    const p = yy * w + xx; if (!a[p]) continue;
    const n = (a[p - 1] === 0) + (a[p + 1] === 0) + (a[p - w] === 0) + (a[p + w] === 0);
    if (n) px[p * 4 + 3] = Math.round(255 * (1 - n / 5));
  }
  x.putImageData(d, 0, 0);
  // trim to content
  let t = h, l = w, r = 0, bm = 0;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (px[(yy * w + xx) * 4 + 3] > 20) { if (yy < t) t = yy; if (yy > bm) bm = yy; if (xx < l) l = xx; if (xx > r) r = xx; }
  // drop the faint floor reflection under the pack (bottom ~3.5% of the photo)
  bm = Math.min(bm, Math.round(h * 0.912));
  const o = document.createElement('canvas'); o.width = r - l + 1; o.height = bm - t + 1;
  o.getContext('2d').drawImage(c, l, t, o.width, o.height, 0, 0, o.width, o.height);
  window.__png = o.toDataURL('image/png'); window.__size = [o.width, o.height]; window.__ready = true;
};
</script>`;

/* ---------- 2. showcase scene ---------- */
const S = 1024;
const sceneHTML = (cutUrl, [cw, ch]) => {
  // product height ~60% of the frame, standing on the stump top (≈ y 790 in the source shot)
  const ph = 600, pw = Math.round(ph * cw / ch), px = Math.round(S / 2 - pw / 2 + 10), py = 800 - ph;
  return `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box} html,body{width:${S}px;height:${S}px;overflow:hidden;background:#dfe9cf}
.layer{position:absolute;inset:0}
.bg{background:url('${asset('assets/products/showcase-gummies.jpg')}') center/cover;filter:blur(34px) saturate(1.08) brightness(1.06);transform:scale(1.25)}
.rays{background:linear-gradient(115deg,rgba(255,252,225,.55) 0%,rgba(255,252,225,0) 38%),radial-gradient(60% 50% at 22% 18%,rgba(255,250,215,.55),transparent 70%)}
.stump{left:0;top:${S - 262}px;width:${S}px;height:262px;background:url('${asset('assets/products/showcase-gummies.jpg')}') 0 -762px/${S}px ${S}px no-repeat;
  -webkit-mask:linear-gradient(90deg,transparent 0 17%,#000 21% 82%,transparent 86%)}
.floor{left:0;right:0;top:${S - 120}px;height:120px;background:linear-gradient(180deg,rgba(230,222,196,0) 0%,rgba(222,212,182,.55) 100%)}
.shadow{left:${px + pw * .08}px;top:${py + ph - 26}px;width:${pw * .86}px;height:46px;border-radius:50%;background:radial-gradient(closest-side,rgba(40,35,20,.45),transparent)}
.pack{left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;filter:drop-shadow(0 18px 22px rgba(30,40,20,.28))}
.leaf{position:absolute;filter:drop-shadow(0 8px 14px rgba(20,50,20,.25))}
.blur{filter:blur(7px) drop-shadow(0 8px 14px rgba(20,50,20,.2))}
</style>
<div class="layer bg"></div><div class="layer rays"></div>
<div class="layer stump" style="position:absolute"></div>
<div class="layer floor"></div>
<img class="leaf blur" src="${asset('assets/ingredients/cutout/peppermint.webp')}" style="left:-70px;top:150px;width:300px;transform:rotate(-24deg);opacity:.8">
<img class="leaf blur" src="${asset('assets/ingredients/cutout/peppermint.webp')}" style="left:820px;top:60px;width:260px;transform:rotate(18deg);opacity:.8">
<div class="layer shadow" style="position:absolute"></div>
<img class="layer pack" style="position:absolute" src="${cutUrl}">
<img class="leaf" src="${asset('assets/ingredients/cutout/peppermint.webp')}" style="left:70px;top:735px;width:250px;transform:rotate(-18deg)">
<img class="leaf" src="${asset('assets/ingredients/cutout/peppermint.webp')}" style="left:740px;top:760px;width:220px;transform:rotate(22deg) scaleX(-1)">
<img class="leaf" src="${asset('assets/ingredients/cutout/ginger.webp')}" style="left:600px;top:850px;width:150px;transform:rotate(8deg)">
`;
};

const b = await launch(S);
try {
  // cut-out
  let tmp = await open(b, CUT_HTML);
  const { result: png } = await b.send('Runtime.evaluate', { expression: 'window.__png', returnByValue: true });
  const { result: size } = await b.send('Runtime.evaluate', { expression: 'window.__size', returnByValue: true });
  const cutPath = join(PUB, 'assets/product-7.png');
  writeFileSync(cutPath, Buffer.from(png.value.split(',')[1], 'base64'));
  console.log('wrote public/assets/product-7.png', size.value.join('×'));

  // scene
  tmp = await open(b, sceneHTML(pathToFileURL(cutPath).href, size.value));
  await new Promise((r) => setTimeout(r, 300));
  const { data } = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: S, height: S, scale: 1 } });
  writeFileSync(join(PUB, 'assets/products/showcase-drops.jpg'), Buffer.from(data, 'base64'));
  console.log('wrote public/assets/products/showcase-drops.jpg');
  rmSync(tmp, { force: true });
} finally {
  b.close();
}
