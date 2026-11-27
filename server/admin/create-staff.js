// Creates a staff account from the terminal (needed once, for the first owner).
//   npm run admin:create -- --email you@tranzlife.in --name "Your Name" [--role owner|manager|support|content_manager]
// Prints a temporary password. On first sign-in at /admin the person sets their own password and
// turns on two-step verification. Uses DATABASE_URL from .env / .env.local (or the local database).
import { parseArgs } from 'node:util';
import { createDb } from '../db/index.js';
import { hashPassword, tempPassword } from './crypto.js';
import { ROLES } from './auth.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'owner' } } });
const email = String(values.email || '').trim().toLowerCase();
const name = String(values.name || '').trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2 || !ROLES.includes(values.role)) {
  console.error('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--role owner|manager|support|content_manager]');
  process.exit(1);
}

const db = await createDb(process.env, { log: { info() {}, log() {}, warn: console.warn, error: console.error } });
const temp = tempPassword();
try {
  await db.query('INSERT INTO staff_users (email, name, role, password_hash) VALUES ($1,$2,$3,$4)', [email, name, values.role, await hashPassword(temp)]);
  await db.query(`INSERT INTO audit_log (staff_email, action, entity, after) VALUES ('terminal', 'staff.create', 'staff', $1)`, [JSON.stringify({ email, role: values.role })]);
  console.log(`\nCreated ${values.role} account for ${email} (${db.kind === 'postgres' ? 'PostgreSQL' : 'local database'}).`);
  console.log(`Temporary password: ${temp}`);
  console.log('Sign in at /admin. You will be asked to set your own password and turn on two-step verification.\n');
} catch (e) {
  console.error(e.code === '23505' ? `A staff account for ${email} already exists.` : e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
