// Product photos in Neon Object Storage (S3-compatible, bucket "product-media", public read).
// Settings come from `neon deploy` / `neon env pull`: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
// AWS_ENDPOINT_URL_S3, AWS_REGION. Every upload is resized (1600 px + 480 px thumbnail), converted
// to WebP and stored under a new key, so it can be cached forever; the key is kept in product_media.
import { randomUUID } from 'node:crypto';

export const MEDIA_BUCKET = 'product-media';
export const DOCS_BUCKET = 'documents';     // private
export const MAX_UPLOAD_MB = 10;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createMedia(env = process.env, { log = console } = {}) {
  const endpoint = env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, '');
  const enabled = !!(endpoint && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
  let client = null;
  const s3 = async () => {
    if (client) return client;
    const { S3Client } = await import('@aws-sdk/client-s3');
    client = new S3Client({
      forcePathStyle: true,                      // required by Neon
      endpoint, region: env.AWS_REGION || 'ap-southeast-1',
      credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
    });
    return client;
  };
  const publicUrl = (key) => `${endpoint}/${MEDIA_BUCKET}/${key}`;

  async function put(key, body, contentType) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await s3()).send(new PutObjectCommand({
      Bucket: MEDIA_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable',
    }));
  }

  /** Resizes and stores one uploaded photo. Returns { url, thumbUrl, key, width, height }. */
  async function uploadProductImage(productId, buffer, contentType, folder = 'products') {
    if (!enabled) throw Object.assign(new Error('Photo storage is not set up (run `neon deploy` and set the AWS_* settings).'), { status: 503 });
    if (!TYPES.has(contentType)) throw Object.assign(new Error('Upload a JPG, PNG or WebP photo.'), { status: 400 });
    const { default: sharp } = await import('sharp');
    let img;
    try {
      img = sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();     // .rotate(): respect phone EXIF orientation
      const meta = await img.metadata();
      if (!meta.width || meta.width < 300 || meta.height < 300) throw Object.assign(new Error('Use a photo at least 300 × 300 pixels.'), { status: 400 });
    } catch (e) {
      if (e.status) throw e;
      throw Object.assign(new Error('That file is not a readable photo.'), { status: 400 });
    }
    const full = await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await img.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const id = randomUUID();
    const safe = String(productId).replace(/[^a-z0-9-]/g, '');
    const key = `${folder}/${safe}/${id}.webp`, thumbKey = `${folder}/${safe}/${id}-480.webp`;
    await put(key, full.data, 'image/webp');
    await put(thumbKey, thumb, 'image/webp');
    return { key, url: publicUrl(key), thumbUrl: publicUrl(thumbKey), width: full.info.width, height: full.info.height };
  }

  async function remove(key) {
    if (!enabled || !key) return;
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const c = await s3();
    for (const k of [key, key.replace(/\.webp$/, '-480.webp')]) {
      await c.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: k })).catch((e) => log.warn?.(`[media] delete ${k}: ${e.message}`));
    }
  }

  // ---- private documents (licences, certificates): never public, streamed to signed-in staff ----
  const DOC_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
  async function putDocument(buffer, contentType) {
    if (!enabled) throw Object.assign(new Error('Document storage is not set up (run `neon deploy` and set the AWS_* settings).'), { status: 503 });
    const ext = DOC_TYPES[contentType];
    if (!ext) throw Object.assign(new Error('Upload a PDF, JPG or PNG file.'), { status: 400 });
    // check the file really is what it says (first bytes), not just the header
    const sig = buffer.subarray(0, 4).toString('hex');
    const okSig = ext === 'pdf' ? sig === '25504446' : ext === 'png' ? sig === '89504e47' : sig.startsWith('ffd8ff');
    if (!okSig) throw Object.assign(new Error('That file does not look like a real PDF or image.'), { status: 400 });
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const key = `certificates/${randomUUID()}.${ext}`;
    await (await s3()).send(new PutObjectCommand({ Bucket: DOCS_BUCKET, Key: key, Body: buffer, ContentType: contentType, CacheControl: 'private, no-store' }));
    return key;
  }
  async function getDocument(key) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const r = await (await s3()).send(new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: key }));
    return { body: Buffer.from(await r.Body.transformToByteArray()), contentType: r.ContentType || 'application/octet-stream' };
  }
  async function removeDocument(key) {
    if (!enabled || !key) return;
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await s3()).send(new DeleteObjectCommand({ Bucket: DOCS_BUCKET, Key: key })).catch((e) => log.warn?.(`[media] delete ${key}: ${e.message}`));
  }

  return { enabled, uploadProductImage, remove, publicUrl, putDocument, getDocument, removeDocument };
}
