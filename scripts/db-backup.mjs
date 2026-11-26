// Off-site JSON / pg_dump database backup helper: `npm run db:backup`
// Writes a timestamped snapshot into ./backups/ (git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createDb } from '../server/db/index.js';

const outDir = join(process.cwd(), 'backups');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (url) {
  try {
    const file = join(outDir, `tranzlife-${stamp}.sql`);
    execFileSync('pg_dump', ['--no-owner', '--no-privileges', url, '-f', file], { stdio: 'inherit' });
    console.log(`Saved SQL backup: ${file}`);
    process.exit(0);
  } catch (e) {
    console.warn(`pg_dump unavailable or failed (${e.message}); falling back to JSON table export.`);
  }
}

const db = await createDb(process.env, { skipSetup: true });
try {
  const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)).rows.map((r) => r.tablename);
  const dump = { exportedAt: new Date().toISOString(), tables: {} };
  for (const t of tables) {
    dump.tables[t] = (await db.query(`SELECT * FROM "${t}"`)).rows;
  }
  const file = join(outDir, `tranzlife-${stamp}.json`);
  writeFileSync(file, JSON.stringify(dump, null, 2));
  console.log(`Saved JSON backup (${tables.length} tables): ${file}`);
} finally {
  await db.close?.();
}
