import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShopApp } from '../shop/app.js';
import { createDb } from '../db/index.js';
import { hashPassword, newTotpSecret, totpCode } from './crypto.js';

async function setup() {
  const db = await createDb({}, { memory: true });
  const app = await buildShopApp({
    db,
    logger: false,
    env: {
      NODE_ENV: 'test',
      SITE_ORIGIN: 'http://localhost',
      SESSION_SECRET: 'test-session-secret-0123456789abcdef',
      ADMIN_SESSION_SECRET: 'test-admin-secret-0123456789abcdef',
    },
  });
  const secret = newTotpSecret();
  await db.query(
    `INSERT INTO staff_users (email, name, role, password_hash, must_change_password, totp_secret, totp_enabled)
     VALUES ('owner@tranzlife.in', 'Owner', 'owner', $1, false, $2, true)`,
    [await hashPassword('StrongPass!2026'), secret],
  );
  const code = totpCode(secret);
  const login = await app.inject({
    method: 'POST', url: '/api/admin/auth/login',
    headers: { origin: 'http://localhost' },
    payload: { email: 'owner@tranzlife.in', password: 'StrongPass!2026', code },
  });
  assert.equal(login.statusCode, 200);
  const cookie = login.headers['set-cookie'];
  return { app, db, cookie };
}

test('system health: runs all checks, records heartbeats, and logs sanitized 5xx errors', async () => {
  const { app, db, cookie } = await setup();
  try {
    // Record a job heartbeat and a simulated error (with email that must be stripped)
    await app.shop.health.recordHeartbeat('orders.release', 'Expired-payment stock release', 5, 'ok', 12);
    await app.shop.health.recordError({ method: 'GET', url: '/api/test?foo=1' }, new Error('Failed for user@example.com'));

    const res = await app.inject({ method: 'GET', url: '/api/admin/health', headers: { cookie } });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(['ok', 'warn', 'error'].includes(body.overall));
    assert.ok(body.checks.length >= 12);
    assert.ok(body.server.nodeVersion.startsWith('v'));
    assert.equal(body.errors.length, 1);
    assert.ok(!body.errors[0].message.includes('user@example.com'));
    assert.ok(body.errors[0].message.includes('[email]'));

    // Run checks on demand
    const run = await app.inject({
      method: 'POST', url: '/api/admin/health/run',
      headers: { cookie, origin: 'http://localhost' }, payload: {},
    });
    assert.equal(run.statusCode, 200);
    assert.ok(run.json().checks.some((c) => c.check_key === 'service.database' && c.status === 'ok'));
  } finally {
    await app.close();
  }
});
