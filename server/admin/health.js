// System health, error logging, background-job heartbeats, and automated alerts
// for Settings -> System health (/api/admin/health).
import { existsSync } from 'node:fs';
import { connect as tlsConnect } from 'node:tls';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHosted } from '../db/index.js';
import { loadSettings } from '../shop/pricing.js';

const ROOT_DIR = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST_DIR = join(ROOT_DIR, 'dist');
const PUBLIC_DIR = join(ROOT_DIR, 'public');

const KNOWN_ROUTES = new Set([
  '/', '/shop', '/about', '/blogs', '/ingredients', '/faq', '/contact',
  '/privacy', '/terms', '/refunds', '/shipping', '/login', '/account', '/checkout',
]);

// Build-time / last-audited package vulnerability summary (never executes npm audit on live requests).
const AUDIT_SUMMARY = {
  auditedAt: '2026-11-25',
  counts: { critical: 0, high: 0, moderate: 4, low: 0 },
  packages: ['shadcn (CLI dev-only via ts-morph -> minimatch)'],
};

export function createHealth({ db, razorpay, twilio, media, env = process.env, log }) {
  const startedAt = Date.now();
  const samples = [];                 // ring buffer (max 2400 recent API responses)
  const MAX_SAMPLES = 2400;
  let rateLimitHits = 0;
  let lastUptimeFetch = 0;
  let cachedUptime = null;
  let lastSslCheck = 0;
  let cachedSsl = null;
  let lastLinksCheck = 0;
  let cachedLinks = null;

  function recordRequest({ statusCode, durationMs }) {
    if (statusCode === 429) rateLimitHits += 1;
    samples.push({ t: Date.now(), status: statusCode, ms: Math.round(durationMs) });
    if (samples.length > MAX_SAMPLES) samples.shift();
  }

  function getMetrics() {
    const cutoff = Date.now() - 24 * 3600e3;
    const recent = samples.filter((s) => s.t >= cutoff);
    const total = recent.length;
    const errors = recent.filter((s) => s.status >= 500).length;
    const sorted = recent.map((s) => s.ms).sort((a, b) => a - b);
    const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;

    // Hourly buckets for the 24h response time & error chart
    const nowHour = Math.floor(Date.now() / 3600e3) * 3600e3;
    const buckets = Array.from({ length: 24 }, (_, idx) => {
      const start = nowHour - (23 - idx) * 3600e3;
      const inB = recent.filter((s) => s.t >= start && s.t < start + 3600e3);
      const avgMs = inB.length ? Math.round(inB.reduce((a, b) => a + b.ms, 0) / inB.length) : 0;
      const errCount = inB.filter((s) => s.status >= 500).length;
      return { hour: new Date(start).toISOString().slice(11, 16), avgMs, errors: errCount, requests: inB.length };
    });

    return { total, errors, errorRatePct: total ? Math.round((errors / total) * 1000) / 10 : 0, p50, p95, buckets };
  }

  async function recordError(req, err) {
    try {
      const status = Number(err?.status || err?.statusCode || 500);
      if (status < 500) return;
      const route = String(req?.routeOptions?.url || req?.url || '/').split('?')[0].slice(0, 120);
      const method = String(req?.method || 'GET').slice(0, 10);
      // Strip potential emails/phones/tokens from error messages before storing
      const rawMsg = String(err?.message || 'Internal error').replace(/[^\s@]+@[^\s@]+/g, '[email]').replace(/\b[6-9]\d{9}\b/g, '[phone]');
      await db.query(
        `INSERT INTO error_log (method, route, status_code, message) VALUES ($1, $2, $3, $4)`,
        [method, route, status, rawMsg.slice(0, 300)],
      );
    } catch (e) {
      log?.warn?.(`[health] could not log error: ${e.message}`);
    }
  }

  async function recordHeartbeat(jobKey, label, intervalMinutes, status = 'ok', durationMs = 0, errorMsg = '') {
    try {
      await db.query(
        `INSERT INTO job_heartbeats (job_key, label, interval_minutes, last_run_at, last_status, last_error, duration_ms)
         VALUES ($1, $2, $3, now(), $4, $5, $6)
         ON CONFLICT (job_key) DO UPDATE SET
           label = EXCLUDED.label, interval_minutes = EXCLUDED.interval_minutes,
           last_run_at = now(), last_status = EXCLUDED.last_status,
           last_error = EXCLUDED.last_error, duration_ms = EXCLUDED.duration_ms`,
        [jobKey, label, intervalMinutes, status, String(errorMsg || '').slice(0, 300), Math.round(durationMs)],
      );
    } catch (e) {
      log?.warn?.(`[health] heartbeat failed for ${jobKey}: ${e.message}`);
    }
  }

  // ---- individual checks ----------------------------------------------------
  async function checkAvailability() {
    const m = getMetrics();
    const uptimeHours = Math.round((Date.now() - startedAt) / 3600e3 * 10) / 10;
    let status = 'ok';
    if (m.errorRatePct >= 5 || m.errors >= 10) status = 'error';
    else if (m.errorRatePct >= 1 || m.p95 > 2000) status = 'warn';
    const summary = m.total
      ? `Up ${uptimeHours}h · p50 ${m.p50}ms, p95 ${m.p95}ms · ${m.errors} errors (${m.errorRatePct}%)`
      : `Up ${uptimeHours}h · no traffic sampled yet`;
    return { group_key: 'availability', check_key: 'availability.api', label: 'API availability & latency', status, summary, details: m };
  }

  async function checkUptime() {
    const apiKey = env.UPTIMEROBOT_API_KEY;
    if (!apiKey) {
      return {
        group_key: 'uptime', check_key: 'uptime.external', label: 'External uptime (UptimeRobot)', status: 'warn',
        summary: 'Not linked yet — add UPTIMEROBOT_API_KEY in Render to show 24/7 uptime %',
        details: { configured: false },
      };
    }
    if (cachedUptime && Date.now() - lastUptimeFetch < 120_000) return cachedUptime;
    try {
      const res = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ api_key: apiKey, custom_uptime_ratios: '1-7-30', format: 'json' }),
        signal: AbortSignal.timeout(5000),
      });
      const json = await res.json();
      const mon = json.monitors?.[0];
      if (!mon) throw new Error('No monitors found on UptimeRobot account');
      const ratio30 = mon.custom_uptime_ratio?.split('-')[2] || mon.all_time_uptime_ratio || '100';
      const up = mon.status === 2;
      const out = {
        group_key: 'uptime', check_key: 'uptime.external', label: 'External uptime (UptimeRobot)',
        status: up ? 'ok' : 'error',
        summary: `${up ? 'Online' : 'Down'} · ${ratio30}% uptime (30d) · ${mon.friendly_name}`,
        details: { configured: true, status: mon.status, ratio30 },
      };
      cachedUptime = out;
      lastUptimeFetch = Date.now();
      return out;
    } catch (e) {
      return { group_key: 'uptime', check_key: 'uptime.external', label: 'External uptime (UptimeRobot)', status: 'warn', summary: `Could not reach UptimeRobot: ${e.message}`, details: { configured: true } };
    }
  }

  async function checkDatabase() {
    const t0 = Date.now();
    try {
      await db.query('SELECT 1');
      const ms = Date.now() - t0;
      const mig = Number((await db.query('SELECT COUNT(*) AS n FROM schema_migrations')).rows[0]?.n || 0);
      let sizeMb = null;
      if (db.kind === 'postgres') {
        const sz = await db.query('SELECT pg_database_size(current_database())::bigint AS b');
        sizeMb = Math.round((Number(sz.rows[0]?.b || 0) / (1024 * 1024)) * 10) / 10;
      }
      const status = ms > 1000 ? 'warn' : 'ok';
      const summary = `Connected in ${ms}ms · ${mig} migrations${sizeMb != null ? ` · ${sizeMb} MB` : ''}`;
      return { group_key: 'services', check_key: 'service.database', label: 'Database (PostgreSQL)', status, summary, details: { ms, migrations: mig, sizeMb, kind: db.kind } };
    } catch (e) {
      return { group_key: 'services', check_key: 'service.database', label: 'Database (PostgreSQL)', status: 'error', summary: `Unreachable: ${e.message}`, details: {} };
    }
  }

  async function checkStorage() {
    if (!media?.configured) {
      return { group_key: 'services', check_key: 'service.storage', label: 'Photo storage (S3 / R2)', status: isHosted(env) ? 'warn' : 'ok', summary: isHosted(env) ? 'Object storage not configured' : 'Local dev mode (no object storage needed)', details: { configured: false } };
    }
    return { group_key: 'services', check_key: 'service.storage', label: 'Photo storage (S3 / R2)', status: 'ok', summary: 'Configured and ready', details: { configured: true } };
  }

  async function checkTwilio() {
    const ok = !!(twilio?.smsReady || twilio?.whatsappReady);
    return {
      group_key: 'services', check_key: 'service.twilio', label: 'Messaging (Twilio SMS / WhatsApp)',
      status: ok ? 'ok' : isHosted(env) ? 'warn' : 'ok',
      summary: ok ? `Ready (SMS: ${twilio.smsReady ? 'yes' : 'no'}, WhatsApp: ${twilio.whatsappReady ? 'yes' : 'no'})` : 'Not configured in local mode',
      details: { smsReady: !!twilio?.smsReady, whatsappReady: !!twilio?.whatsappReady },
    };
  }

  async function checkRazorpay() {
    const ready = !!razorpay?.ready;
    const last = (await db.query(`SELECT MAX(paid_at) AS last_paid FROM payments WHERE status = 'paid'`)).rows[0]?.last_paid;
    return {
      group_key: 'services', check_key: 'service.razorpay', label: 'Payments (Razorpay)',
      status: ready ? 'ok' : isHosted(env) ? 'error' : 'ok',
      summary: ready ? (last ? `Keys configured · last payment ${new Date(last).toLocaleDateString('en-IN')}` : 'Keys configured · no live payments yet') : 'Razorpay keys not set',
      details: { ready, lastPaidAt: last },
    };
  }

  async function checkChat() {
    const hasKey = !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
    return {
      group_key: 'services', check_key: 'service.chat', label: 'Tulsi chat engine',
      status: hasKey ? 'ok' : 'warn',
      summary: hasKey ? 'API key configured' : 'GEMINI_API_KEY not set (running scripted answers only)',
      details: { configured: hasKey },
    };
  }

  async function checkSsl(force = false) {
    if (!force && cachedSsl && Date.now() - lastSslCheck < 12 * 3600e3) return cachedSsl;
    const siteUrl = env.SITE_URL;
    if (!siteUrl || /localhost|127\.0\.0\.1/i.test(siteUrl)) {
      return { group_key: 'ssl', check_key: 'ssl.cert', label: 'SSL certificate', status: 'ok', summary: 'Skipped in local development', details: {} };
    }
    try {
      const host = new URL(siteUrl).hostname;
      const cert = await new Promise((resolveTls, rejectTls) => {
        const sock = tlsConnect(443, host, { servername: host, timeout: 4000 }, () => {
          const c = sock.getPeerCertificate();
          sock.end();
          resolveTls(c);
        });
        sock.on('error', rejectTls);
        sock.on('timeout', () => { sock.destroy(); rejectTls(new Error('TLS timeout')); });
      });
      const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400e3);
      const status = days <= 3 ? 'error' : days <= 14 ? 'warn' : 'ok';
      const out = { group_key: 'ssl', check_key: 'ssl.cert', label: 'SSL certificate', status, summary: `Valid for ${days} days (expires ${new Date(cert.valid_to).toISOString().slice(0, 10)})`, details: { days, host } };
      cachedSsl = out;
      lastSslCheck = Date.now();
      return out;
    } catch (e) {
      return { group_key: 'ssl', check_key: 'ssl.cert', label: 'SSL certificate', status: 'warn', summary: `Could not verify SSL: ${e.message}`, details: {} };
    }
  }

  async function checkJobs() {
    const rows = (await db.query(`SELECT * FROM job_heartbeats ORDER BY job_key`)).rows;
    if (!rows.length) {
      return { group_key: 'jobs', check_key: 'jobs.heartbeats', label: 'Background jobs', status: 'ok', summary: 'Waiting for first 5-minute cycle after boot', details: { jobs: [] } };
    }
    const stale = rows.filter((j) => (Date.now() - new Date(j.last_run_at).getTime()) > Math.max(15, j.interval_minutes * 3) * 60_000);
    const failed = rows.filter((j) => j.last_status === 'error');
    const status = failed.length ? 'error' : stale.length ? 'warn' : 'ok';
    const summary = failed.length
      ? `${failed.length} job failed (${failed.map((j) => j.label).join(', ')})`
      : stale.length
        ? `${stale.length} job overdue`
        : `All ${rows.length} scheduled jobs healthy`;
    return { group_key: 'jobs', check_key: 'jobs.heartbeats', label: 'Background jobs', status, summary, details: { jobs: rows } };
  }

  async function checkSecurity() {
    const staffStats = (await db.query(`
      SELECT COUNT(*) FILTER (WHERE active AND must_change_password) AS temp_pw,
             COUNT(*) FILTER (WHERE active AND NOT totp_enabled) AS no_2fa,
             COUNT(*) FILTER (WHERE active AND locked_until > now()) AS locked,
             COUNT(*) FILTER (WHERE active AND (last_login_at IS NULL OR last_login_at < now() - interval '60 days')) AS stale_staff
        FROM staff_users`)).rows[0];
    const otpSpike = Number((await db.query(`SELECT COUNT(*) AS n FROM otp_codes WHERE created_at > now() - interval '1 hour'`)).rows[0]?.n || 0);
    const weakSecrets = isHosted(env) && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32);

    const issues = [];
    if (weakSecrets) issues.push('weak or missing session secrets');
    if (Number(staffStats.temp_pw) > 0) issues.push(`${staffStats.temp_pw} staff still on temporary password`);
    if (Number(staffStats.no_2fa) > 0) issues.push(`${staffStats.no_2fa} staff without 2FA`);
    if (Number(staffStats.locked) > 0) issues.push(`${staffStats.locked} locked staff account(s)`);
    if (otpSpike > 60) issues.push(`OTP spike (${otpSpike} in 1h)`);

    const status = weakSecrets || otpSpike > 100 ? 'error' : issues.length ? 'warn' : 'ok';
    const summary = issues.length ? issues.join(' · ') : `All checks clear · ${rateLimitHits} rate-limit hits since boot`;
    return {
      group_key: 'security', check_key: 'security.posture', label: 'Security & access posture', status, summary,
      details: { ...staffStats, otpSpike1h: otpSpike, rateLimitHits, weakSecrets },
    };
  }

  async function checkVulnerabilities() {
    const c = AUDIT_SUMMARY.counts;
    const status = c.critical > 0 || c.high > 0 ? 'error' : c.moderate > 0 ? 'warn' : 'ok';
    const summary = c.critical + c.high + c.moderate === 0
      ? '0 known vulnerabilities'
      : `${c.high} high, ${c.moderate} moderate (${AUDIT_SUMMARY.packages.join(', ')})`;
    return { group_key: 'security', check_key: 'security.vulnerabilities', label: 'Package vulnerabilities', status, summary, details: AUDIT_SUMMARY };
  }

  async function checkLinks(force = false) {
    if (!force && cachedLinks && Date.now() - lastLinksCheck < 12 * 3600e3) return cachedLinks;
    const broken = [];
    const baseDir = existsSync(DIST_DIR) ? DIST_DIR : PUBLIC_DIR;
    const rows = (await db.query(`SELECT id, name, content FROM products WHERE active = true`)).rows;
    for (const r of rows) {
      const c = typeof r.content === 'string' ? JSON.parse(r.content) : (r.content || {});
      const img = c.image || c.images?.[0];
      if (img && !/^https?:\/\//i.test(img)) {
        const clean = img.replace(/^\//, '');
        if (!existsSync(join(baseDir, clean)) && !existsSync(join(PUBLIC_DIR, clean))) {
          broken.push(`${r.name}: missing image (${img})`);
        }
      }
    }
    const anns = (await db.query(`SELECT text, link FROM announcements WHERE active = true AND link IS NOT NULL AND link <> ''`)).rows;
    for (const a of anns) {
      if (a.link.startsWith('/') && !KNOWN_ROUTES.has(a.link) && !a.link.startsWith('/products/') && !a.link.startsWith('/blogs/')) {
        broken.push(`Announcement link points to unknown route (${a.link})`);
      }
    }
    const status = broken.length ? 'warn' : 'ok';
    const summary = broken.length ? `${broken.length} broken link(s): ${broken.slice(0, 2).join('; ')}` : `All ${rows.length} product assets & ${anns.length} announcement links verified`;
    const out = { group_key: 'links', check_key: 'links.assets', label: 'Broken links & media assets', status, summary, details: { broken } };
    cachedLinks = out;
    lastLinksCheck = Date.now();
    return out;
  }

  async function checkDataHealth() {
    const stuckPaid = Number((await db.query(`
      SELECT COUNT(*) AS n FROM orders o JOIN payments p ON p.order_id = o.id
       WHERE o.status = 'pending_payment' AND p.status = 'paid'`)).rows[0]?.n || 0);
    const unshipped48 = Number((await db.query(`
      SELECT COUNT(*) AS n FROM orders WHERE status = 'packed' AND updated_at < now() - interval '48 hours'`)).rows[0]?.n || 0);
    const badStock = Number((await db.query(`
      SELECT COUNT(*) AS n FROM inventory WHERE on_hand < 0 OR reserved < 0 OR reserved > on_hand`)).rows[0]?.n || 0);
    const failedSms24 = Number((await db.query(`
      SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND created_at > now() - interval '24 hours'`)).rows[0]?.n || 0);
    const incompleteProducts = Number((await db.query(`
      SELECT COUNT(*) AS n FROM products WHERE active = true AND (price IS NULL OR price <= 0)`)).rows[0]?.n || 0);

    const problems = [];
    if (stuckPaid > 0) problems.push(`${stuckPaid} paid order(s) stuck in pending_payment`);
    if (badStock > 0) problems.push(`${badStock} inventory mismatch(es)`);
    if (unshipped48 > 0) problems.push(`${unshipped48} packed order(s) waiting >48h`);
    if (failedSms24 > 0) problems.push(`${failedSms24} failed customer message(s) (24h)`);
    if (incompleteProducts > 0) problems.push(`${incompleteProducts} active product(s) without price`);

    const status = stuckPaid > 0 || badStock > 0 ? 'error' : problems.length ? 'warn' : 'ok';
    const summary = problems.length ? problems.join(' · ') : 'Orders, stock, and catalogue data consistent';
    return {
      group_key: 'data', check_key: 'data.integrity', label: 'Orders, stock & data integrity', status, summary,
      details: { stuckPaid, unshipped48, badStock, failedSms24, incompleteProducts },
    };
  }

  async function checkWebVitals() {
    const rows = (await db.query(`
      SELECT props->>'lcp' AS lcp, props->>'cls' AS cls, props->>'inp' AS inp
        FROM analytics_events
       WHERE event = 'vitals' AND created_at > now() - interval '7 days'
       LIMIT 500`)).rows;
    if (!rows.length) {
      return { group_key: 'speed', check_key: 'speed.vitals', label: 'Real-user speed (Core Web Vitals)', status: 'ok', summary: 'Collecting visitor telemetry (no samples in last 7d yet)', details: { count: 0 } };
    }
    const nums = (k) => rows.map((r) => Number(r[k])).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
    const p75 = (arr) => (arr.length ? arr[Math.floor(arr.length * 0.75)] : null);
    const lcp = p75(nums('lcp')), cls = p75(nums('cls')), inp = p75(nums('inp'));
    const status = (lcp != null && lcp > 4000) || (cls != null && cls > 0.25) ? 'warn' : 'ok';
    const summary = `p75 LCP ${lcp ?? '—'}ms · CLS ${cls ?? '—'} · INP ${inp ?? '—'}ms (${rows.length} samples)`;
    return { group_key: 'speed', check_key: 'speed.vitals', label: 'Real-user speed (Core Web Vitals)', status, summary, details: { lcp, cls, inp, count: rows.length } };
  }

  async function runAllChecks({ force = false, notifyCritical = true } = {}) {
    const runners = [
      checkAvailability, checkUptime, checkDatabase, checkStorage, checkTwilio,
      checkRazorpay, checkChat, () => checkSsl(force), checkJobs, checkSecurity,
      checkVulnerabilities, () => checkLinks(force), checkDataHealth, checkWebVitals,
    ];
    const results = [];
    for (const fn of runners) {
      const t0 = Date.now();
      let res;
      try { res = await fn(); } catch (e) {
        res = { group_key: 'availability', check_key: 'unknown', label: 'Check error', status: 'error', summary: e.message, details: {} };
      }
      const dur = Date.now() - t0;
      await db.query(
        `INSERT INTO health_checks (group_key, check_key, label, status, summary, details, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [res.group_key, res.check_key, res.label, res.status, res.summary, JSON.stringify(res.details || {}), dur],
      );
      await syncIncident(res, notifyCritical);
      results.push({ ...res, duration_ms: dur, checked_at: new Date().toISOString() });
    }
    return results;
  }

  async function syncIncident(res, notifyCritical) {
    const open = (await db.query(`SELECT * FROM health_incidents WHERE check_key = $1 AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1`, [res.check_key])).rows[0];
    if (res.status === 'ok') {
      if (open) await db.query(`UPDATE health_incidents SET resolved_at = now() WHERE id = $1`, [open.id]);
      return;
    }
    if (!open) {
      const ins = (await db.query(
        `INSERT INTO health_incidents (check_key, label, status, summary) VALUES ($1, $2, $3, $4) RETURNING *`,
        [res.check_key, res.label, res.status, res.summary],
      )).rows[0];
      if (notifyCritical && res.status === 'error') await sendCriticalAlert(ins);
    } else if (open.status !== res.status || open.summary !== res.summary) {
      await db.query(`UPDATE health_incidents SET status = $2, summary = $3 WHERE id = $1`, [open.id, res.status, res.summary]);
      if (notifyCritical && res.status === 'error' && !open.notified_at) await sendCriticalAlert(open);
    }
  }

  async function sendCriticalAlert(incident) {
    try {
      const channel = String(env.ORDER_NOTIFICATIONS || 'off').toLowerCase();
      const ready = (channel === 'sms' && twilio?.smsReady) || (channel === 'whatsapp' && twilio?.whatsappReady);
      if (!ready) return;
      const settings = await loadSettings(db.query);
      const phones = settings.daily_summary?.phones || [];
      if (!phones.length) return;
      const msg = `TranzLife ALERT: ${incident.label} — ${incident.summary}`;
      for (const phone of phones.slice(0, 5)) {
        try {
          if (channel === 'whatsapp') await twilio.sendWhatsApp(phone, msg);
          else await twilio.sendSms(phone, msg);
        } catch (e) { log?.warn?.(`[health] critical alert send failed: ${e.message}`); }
      }
      await db.query(`UPDATE health_incidents SET notified_at = now() WHERE id = $1`, [incident.id]);
    } catch (e) {
      log?.warn?.(`[health] critical alert error: ${e.message}`);
    }
  }

  async function sweep() {
    const t0 = Date.now();
    try {
      await runAllChecks({ force: false, notifyCritical: true });
      // Prune history: 30 days for health_checks, 14 days for error_log
      await db.query(`DELETE FROM health_checks WHERE checked_at < now() - interval '30 days'`);
      await db.query(`DELETE FROM error_log WHERE created_at < now() - interval '14 days'`);
      await recordHeartbeat('health.sweep', 'System health & log prune', 10, 'ok', Date.now() - t0);
    } catch (e) {
      await recordHeartbeat('health.sweep', 'System health & log prune', 10, 'error', Date.now() - t0, e.message);
      throw e;
    }
  }

  async function getDashboard() {
    let latest = (await db.query(`
      SELECT DISTINCT ON (check_key) * FROM health_checks ORDER BY check_key, checked_at DESC`)).rows;
    if (!latest.length) {
      latest = await runAllChecks({ force: false, notifyCritical: false });
    }
    const incidents = (await db.query(`SELECT * FROM health_incidents ORDER BY started_at DESC LIMIT 25`)).rows;
    const errors = (await db.query(`SELECT * FROM error_log ORDER BY created_at DESC LIMIT 20`)).rows;
    const historyRows = (await db.query(`
      SELECT check_key, date_trunc('day', checked_at)::date AS day,
             CASE WHEN BOOL_OR(status = 'error') THEN 'error'
                  WHEN BOOL_OR(status = 'warn') THEN 'warn'
                  ELSE 'ok' END AS worst
        FROM health_checks
       WHERE checked_at > now() - interval '7 days'
       GROUP BY check_key, date_trunc('day', checked_at)::date
       ORDER BY day ASC`)).rows;

    const historyByKey = {};
    for (const h of historyRows) {
      if (!historyByKey[h.check_key]) historyByKey[h.check_key] = [];
      historyByKey[h.check_key].push({ day: String(h.day).slice(0, 10), status: h.worst });
    }

    const overall = latest.some((c) => c.status === 'error') ? 'error'
      : latest.some((c) => c.status === 'warn') ? 'warn' : 'ok';

    const mem = process.memoryUsage();
    return {
      overall,
      checkedAt: latest[0]?.checked_at || new Date().toISOString(),
      server: {
        nodeVersion: process.version,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        memoryMb: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        env: isHosted(env) ? 'production' : 'development',
      },
      metrics: getMetrics(),
      checks: latest.map((c) => ({ ...c, history7d: historyByKey[c.check_key] || [] })),
      incidents,
      errors,
    };
  }

  return { recordRequest, recordError, recordHeartbeat, runAllChecks, sweep, getDashboard };
}

export default async function healthAdminRoutes(app, { health, G }) {
  app.get('/api/admin/health', G('settings'), async () => health.getDashboard());
  app.post('/api/admin/health/run', G('settings'), async () => {
    await health.runAllChecks({ force: true, notifyCritical: true });
    return health.getDashboard();
  });
}
