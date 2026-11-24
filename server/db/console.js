// Look inside the shop database from the terminal.
//   npm run db                                   interactive SQL console
//   npm run db -- "SELECT * FROM orders"         run one query and exit
// Uses DATABASE_URL from .env if set (e.g. Render's external URL), otherwise the local PGlite
// database in ./data/pglite. Stop `npm run dev:api` first when using the local database:
// only one program can open that folder at a time.
//
// Shortcuts:  \dt  list tables    \d <table>  columns of a table    \q  quit
import readline from 'node:readline';
import { createDb } from './index.js';

const quiet = { info() {}, log() {}, warn: console.warn, error: console.error };
const db = await createDb(process.env, { log: quiet });
const where = db.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : 'local PGlite (./data/pglite)';

const SHORTCUTS = {
  '\\dt': `SELECT table_name AS table, (xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM ' || quote_ident(table_name), false, true, '')))[1]::text::int AS rows
           FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
};
const describe = (t) => ({
  sql: `SELECT column_name AS column, data_type AS type, is_nullable AS nullable, column_default AS "default"
          FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
  params: [t],
});

// money columns are in paise: show rupees alongside so they are easy to read
const MONEY = new Set(['price', 'mrp', 'subtotal', 'discount', 'shipping', 'tax', 'total', 'amount', 'unit_price', 'unit_mrp', 'line_total']);
const pretty = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => {
  if (MONEY.has(k) && typeof v === 'number') return [k, `₹${(v / 100).toLocaleString('en-IN')}`];
  if (v instanceof Date) return [k, v.toISOString().replace('T', ' ').slice(0, 19)];
  if (v && typeof v === 'object') return [k, JSON.stringify(v).slice(0, 60)];
  return [k, v];
})));

async function run(input) {
  const text = input.trim().replace(/;$/, '');
  if (!text) return;
  let sql = SHORTCUTS[text] ?? text, params;
  const d = text.match(/^\\d\s+(\w+)$/);
  if (d) ({ sql, params } = describe(d[1]));
  try {
    const r = await db.query(sql, params);
    const rows = r.rows ?? [];
    if (rows.length) console.table(pretty(rows));
    console.log(`(${rows.length} row${rows.length === 1 ? '' : 's'})`);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

const once = process.argv.slice(2).join(' ');
if (once) {
  await run(once);
  await db.close?.();
} else {
  console.log(`Connected to ${where}.  \\dt tables · \\d <table> columns · \\q quit\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'shop> ' });
  rl.prompt();
  for await (const line of rl) {
    if (line.trim() === '\\q') break;
    await run(line);
    rl.prompt();
  }
  rl.close();
  await db.close?.();
}
