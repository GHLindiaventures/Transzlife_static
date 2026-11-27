// Database connection for the shop backend.
//   - Production (Render): PostgreSQL on Neon via DATABASE_URL (pooled, used by the app) and
//     DATABASE_URL_UNPOOLED (direct, used for schema migrations). Driver: node-postgres (`pg`),
//     a long-lived pool, since the server is a long-running Node process. `neon env pull`
//     writes both URLs to .env.local.
//   - Local development without DATABASE_URL: PGlite, a real Postgres engine embedded in Node,
//     stored in ./data/pglite (git-ignored). No install needed.
// Both expose the same small interface:
//   db.query(sql, params) -> { rows }      parameterised, never string-concatenated
//   db.exec(sql)                            multi-statement SQL (migrations only)
//   db.tx(async (t) => ...)                 a transaction; t.query works like db.query
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

const DATA_DIR = resolve(fileURLToPath(new URL('../../data/pglite', import.meta.url)));

export const isHosted = (env) => env.NODE_ENV === 'production' || !!env.RENDER;

export async function createDb(env = process.env, { log = console, memory = false, skipSetup = false } = {}) {
  let db;
  if (env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    // calendar dates (expiry, manufacturing, licence dates) stay plain 'YYYY-MM-DD' strings, so they
    // never shift by a day between the server's and the browser's time zones
    pg.types.setTypeParser(1082, (v) => v);
    // Neon URLs say sslmode=require. Pin verify-full (check the server certificate), which is what
    // pg does today; pg v9 would otherwise downgrade "require" to encryption without verification.
    const connectionString = env.DATABASE_URL.replace(/([?&])sslmode=(prefer|require|verify-ca)\b/, '$1sslmode=verify-full');
    const pool = new pg.Pool({
      connectionString,
      max: Number(env.DB_POOL_MAX || 10),
      statement_timeout: Number(env.DB_STATEMENT_TIMEOUT_MS || 15000),
      ssl: env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (e) => log.error?.('[db] idle client error', e.message));
    db = {
      kind: 'postgres',
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      async tx(fn) {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const out = await fn({ query: (sql, params) => c.query(sql, params) });
          await c.query('COMMIT');
          return out;
        } catch (e) {
          await c.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    // Never fall back to a local file on a hosted server: its disk is wiped on every deploy,
    // so orders would be lost. The shop API stays off until DATABASE_URL is set.
    if (isHosted(env)) throw new Error('DATABASE_URL is not set. The shop API needs PostgreSQL in production.');
    const { PGlite } = await import('@electric-sql/pglite');
    // PGLITE_DIR: a different local database folder (e.g. a throwaway copy for testing while `npm run dev` holds data/pglite)
    const dir = env.PGLITE_DIR ? resolve(env.PGLITE_DIR) : DATA_DIR;
    if (!memory) mkdirSync(dir, { recursive: true });
    const pgl = memory ? new PGlite() : new PGlite(dir);
    await pgl.waitReady;
    // PGlite runs one statement at a time; a simple queue keeps transactions from interleaving
    let chain = Promise.resolve();
    const serial = (fn) => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
    db = {
      kind: memory ? 'pglite-memory' : 'pglite',
      query: (sql, params) => serial(() => pgl.query(sql, params)),
      exec: (sql) => serial(() => pgl.exec(sql)),
      tx: (fn) => serial(() => pgl.transaction((t) => fn({ query: (sql, params) => t.query(sql, params) }))),
      close: () => pgl.close(),
    };
  }
  if (skipSetup) return db;
  // Schema migrations use the direct (non-pooled) connection when one is given: Neon's pooled URL
  // goes through PgBouncer in transaction mode, which is meant for app queries, not schema changes.
  if (db.kind === 'postgres' && env.DATABASE_URL_UNPOOLED && env.DATABASE_URL_UNPOOLED !== env.DATABASE_URL) {
    const direct = await createDb({ ...env, DATABASE_URL: env.DATABASE_URL_UNPOOLED, DATABASE_URL_UNPOOLED: '', DB_POOL_MAX: '1' }, { log, skipSetup: true });
    try { await migrate(direct, log); } finally { await direct.close(); }
  } else {
    await migrate(db, log);
  }
  await seed(db, log);
  return db;
}
