// Turns the final product photos in /final_product into every image the site uses for those products:
//
//   public/assets/products/showcase-<key>-v3.jpg  1024×1024 home-page card + first product-page slide
//   public/img/p/<key>-v<ver>.webp                product photo (shop cards, cart, account, gallery)
//   public/assets/product-<n>.png                 transparent cut-out (mega menu, drawer, home slider)
//
//   node scripts/gallery/import-final-products.mjs
//   node scripts/gallery/build-gallery.mjs <product-id> ...   (then re-render the product-page slides)
//
// Photos on a plain background (gummies, inhaler) get a real cut-out: the background is flood-filled
// from the image edges, so it follows soft gradients. Lifestyle scenes (liver, reviva) keep their scene
// and the "cut-out" is a rounded crop of the product. `scene` is a square lifestyle shot (product on a
// stone, greenery behind) used for the showcase. New file names per version so browsers and the
// database (migrations 020, 022) never show a cached old photo.

import sharp from 'sharp';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'final_product');
const PUB = join(ROOT, 'public');

/* crop boxes are fractions of the source image: [left, top, width, height] */
const PHOTOS = [
  // plain-background pack shots: real cut-outs; the showcase is the matching lifestyle scene
  { key: 'pulmoclear', n: 4, ver: 2, file: 'Lung Booster Gummies.png', plain: true, scene: 'new-pulmo.jpeg' },
  { key: 'breathefree', n: 6, ver: 2, file: 'Tranzlife Calm Inhaler Product Mockup.png', plain: true, scene: 'new-inhaler.jpeg' },
  // lifestyle scenes only: the product photo / cut-out is a crop around the bottle
  { key: 'liver', n: 5, ver: 3, file: 'new-liver.jpeg', scene: 'new-liver.jpeg', product: [0.2, 0.02, 0.6, 0.92] },
  { key: 'reviva', n: 3, ver: 3, file: 'new-reviva.jpeg', scene: 'new-reviva.jpeg', product: [0.2, 0.03, 0.6, 0.91] },
];

const box = (meta, [l, t, w, h]) => {
  const left = Math.round(l * meta.width), top = Math.round(t * meta.height);
  return { left, top, width: Math.min(meta.width - left, Math.round(w * meta.width)), height: Math.min(meta.height - top, Math.round(h * meta.height)) };
};

/** Alpha mask of the foreground: flood-fill the background from every edge pixel (gradient-tolerant). */
async function cutout(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(at);
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const near = (c) => corners.some((k) => dist(c, k) < 60);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = y * w + x; if (!bg[i] && near(at(i))) { bg[i] = 1; queue[qt++] = i; } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = y * w + x; if (!bg[i] && near(at(i))) { bg[i] = 1; queue[qt++] = i; } }
  while (qh < qt) {
    const i = queue[qh++], c = at(i), x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || bg[j]) continue;
      const cj = at(j);
      // a small step from the neighbour (soft gradients) and still close to the background colours
      if (dist(cj, c) < 7 && near(cj)) { bg[j] = 1; queue[qt++] = j; }
    }
  }
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = bg[i] ? 0 : 255;
  // soften the edge by a pixel so the cut-out doesn't look jagged
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(0.8).extractChannel(0).raw().toBuffer();
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).joinChannel(soft, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

/** Rounded-corner crop with transparent corners (for scenes that have no plain background). */
async function roundedCrop(input, radius) {
  const m = await sharp(input).metadata();
  const mask = Buffer.from(`<svg width="${m.width}" height="${m.height}"><rect width="100%" height="100%" rx="${radius}" ry="${radius}"/></svg>`);
  return sharp(input).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

for (const p of PHOTOS) {
  const src = join(SRC, p.file);
  const meta = await sharp(src).metadata();

  // 1) square showcase (home-page card, first slide on the product page)
  const sq = p.scene ? sharp(join(SRC, p.scene)) : p.square ? sharp(src).extract(box(meta, p.square)) : sharp(src);
  await sq.resize(1024, 1024, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true }).toFile(join(PUB, `assets/products/showcase-${p.key}-v3.jpg`));

  let product, cut;
  if (p.plain) {
    // 2) product photo on white  3) transparent cut-out, trimmed to the product
    const transparent = await cutout(src);
    cut = await sharp(transparent).trim({ threshold: 1 }).toBuffer();
    const fit = await sharp(cut).flatten({ background: '#ffffff' }).resize(940, 940, { fit: 'contain', background: '#ffffff' }).toBuffer();
    product = await sharp(fit).extend({ top: 80, bottom: 80, left: 80, right: 80, background: '#ffffff' }).webp({ quality: 84 }).toBuffer();
  } else {
    const crop = await sharp(src).extract(box(meta, p.product)).toBuffer();
    product = await sharp(crop).resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    cut = await roundedCrop(await sharp(crop).resize({ width: 816 }).toBuffer(), 56);
  }
  await sharp(product).toFile(join(PUB, `img/p/${p.key}-v${p.ver}.webp`));
  await sharp(cut).resize(816, 1224, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(join(PUB, `assets/product-${p.n}.png`));
  console.log(`${p.key}: showcase, photo and cut-out written`);
}
