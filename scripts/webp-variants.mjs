// Build step: a WebP copy next to every sizeable JPG/PNG in dist/ ("photo.jpg" -> "photo.jpg.webp").
// The server (server/index.js) sends that copy to browsers that accept WebP, so every existing
// image reference gets the lighter file without renaming anything in the code.
//
//   node scripts/webp-variants.mjs            (runs as part of `npm run build`)
//
// Photos wider than 1920 px are scaled down (nothing on the site is shown larger). A copy is only
// kept when it is at least 10% smaller than the original.
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const MIN_BYTES = 30 * 1024;          // small icons are not worth it
const MAX_WIDTH = 1920;

function* images(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) yield* images(path);
    else if (/\.(jpe?g|png)$/i.test(name) && st.size >= MIN_BYTES) yield { path, size: st.size };
  }
}

let before = 0, after = 0, made = 0;
for (const { path, size } of images(ROOT)) {
  const out = `${path}.webp`;
  try {
    const img = sharp(path, { failOn: 'none' });
    const { width = 0 } = await img.metadata();
    const pipeline = width > MAX_WIDTH ? img.resize({ width: MAX_WIDTH }) : img;
    const isPng = extname(path).toLowerCase() === '.png';
    const info = await pipeline.webp({ quality: isPng ? 82 : 78, alphaQuality: 90, effort: 5 }).toFile(out);
    if (info.size > size * 0.9) { unlinkSync(out); continue; }
    before += size; after += info.size; made++;
  } catch (e) {
    console.warn(`  skipped ${path}: ${e.message}`);
  }
}
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`✓ WebP copies: ${made} images, ${mb(before)} MB -> ${mb(after)} MB`);
