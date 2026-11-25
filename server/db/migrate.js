// Applies server/db/migrations/*.sql in name order, once each, recording them in schema_migrations.
// Never edit a migration that has run in production: add a new numbered file instead.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

export async function migrate(db, log = console) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    if (done.has(name)) continue;
    const sql = readFileSync(DIR + name, 'utf8');
    await db.tx(async (t) => {
      // statements are separated by a line containing only "-- ;;" so each one runs on its own
      // (PGlite's parameterised query takes one statement at a time), all inside one transaction
      for (const stmt of sql.split(/^--\s*;;\s*$/m).map((s) => s.trim()).filter(Boolean)) await t.query(stmt);
      await t.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    });
    log.info?.(`[db] applied migration ${name}`) ?? log.log?.(`[db] applied migration ${name}`);
  }
}
