// Website text content from the database.
//   GET /api/content   every document: { docs: { key: data } }
// Documents are listed in src/content/registry.js. A document missing from the table is created once from the
// built-in starting copy; afterwards the database is the only source and code changes never overwrite it.
import { DOCS } from '../../src/content/registry.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export async function seedSiteDocs(q) {
  const have = new Set((await q('SELECT key FROM site_docs')).rows.map((r) => r.key));
  let made = 0;
  for (const [key, { target }] of Object.entries(DOCS)) {
    if (have.has(key)) continue;
    await q('INSERT INTO site_docs (key, data, updated_by) VALUES ($1, $2::jsonb, $3) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(clone(target)), 'starting copy']);
    made++;
  }
  return made;
}

export async function loadSiteDocs(q) {
  const docs = {};
  for (const r of (await q('SELECT key, data FROM site_docs')).rows) if (DOCS[r.key]) docs[r.key] = r.data;
  return docs;
}

export default async function siteDocRoutes(app, { db }) {
  const made = await seedSiteDocs(db.query);
  if (made) app.log.info(`[content] created ${made} site document(s) from the starting copy`);
  app.get('/api/content', async (req, reply) => {
    reply.header('Cache-Control', 'public, max-age=30');
    return { docs: await loadSiteDocs(db.query) };
  });
}
