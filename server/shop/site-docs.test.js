import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../db/index.js';
import { buildShopApp } from './app.js';
import { DOCS } from '../../src/content/registry.js';

const ENV = { NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40) };

test('every site document is created in the database and served by /api/content', async () => {
  const db = await createDb(ENV, { memory: true, log: { info() {}, log() {}, warn() {}, error() {} } });
  const app = await buildShopApp({ env: ENV, db, logger: false });
  const res = await app.inject({ method: 'GET', url: '/api/content' });
  assert.equal(res.statusCode, 200);
  const { docs } = res.json();
  assert.deepEqual(Object.keys(docs).sort(), Object.keys(DOCS).sort());
  assert.ok(!('articles' in docs), 'blog articles live in the blog CMS (/api/blog), not in site text');
  // the database is the only source: an edited document is what the site gets, and a restart does not overwrite it
  await db.query(`UPDATE site_docs SET data = '{"edited":true}'::jsonb WHERE key = 'site.REELS'`);
  const again = await app.inject({ method: 'GET', url: '/api/content' });
  assert.deepEqual(again.json().docs['site.REELS'], { edited: true });
  await app.close();
});
