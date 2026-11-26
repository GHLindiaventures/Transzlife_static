// Contact-form enquiries and newsletter subscribers (staff).
//   GET   /api/admin/enquiries       list contact_messages + newsletter summary
//   PATCH /api/admin/enquiries/:id   update status ('new' | 'handled' | 'spam')
//   GET   /api/admin/newsletter.csv  CSV export of active newsletter subscribers
import { z } from 'zod';

const PAGE = 25;
const like = (s) => `%${String(s).replace(/[%_\\]/g, (c) => '\\' + c)}%`;
const pageOf = (q) => Math.max(1, Math.min(10000, Number.parseInt(q?.page, 10) || 1));
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export default async function enquiryAdminRoutes(app, { db, G, parse, audit }) {
  const q = db.query;

  app.get('/api/admin/enquiries', G('view'), async (req) => {
    const status = ['new', 'handled', 'spam'].includes(req.query?.status) ? req.query.status : 'all';
    const search = String(req.query?.q || '').trim();
    const page = pageOf(req.query);
    const where = [];
    const params = [];

    if (status !== 'all') {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(like(search));
      const p = `$${params.length}`;
      where.push(`(name ILIKE ${p} ESCAPE '\\' OR email ILIKE ${p} ESCAPE '\\' OR phone ILIKE ${p} ESCAPE '\\' OR topic ILIKE ${p} ESCAPE '\\' OR message ILIKE ${p} ESCAPE '\\')`);
    }

    const filterSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [totalRow, countsRes, rowsRes, subCountRes, subsRes] = await Promise.all([
      q(`SELECT COUNT(*)::int AS n FROM contact_messages ${filterSql}`, params),
      q(`SELECT status, COUNT(*)::int AS n FROM contact_messages GROUP BY status`),
      q(
        `SELECT id, name, email, phone, topic, product, city, method, message, status, created_at
           FROM contact_messages ${filterSql}
          ORDER BY created_at DESC
          LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
        params,
      ),
      q(`SELECT COUNT(*)::int AS n FROM newsletter_subscribers WHERE unsubscribed_at IS NULL`),
      q(`SELECT email, source, created_at FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at DESC LIMIT 20`),
    ]);

    const counts = { all: 0, new: 0, handled: 0, spam: 0 };
    for (const r of countsRes.rows) {
      counts[r.status] = r.n;
      counts.all += r.n;
    }

    const total = totalRow.rows[0].n;
    return {
      rows: rowsRes.rows,
      counts,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      newsletter: {
        total: subCountRes.rows[0].n,
        recent: subsRes.rows,
      },
    };
  });

  app.patch('/api/admin/enquiries/:id', G('orders.note'), async (req, reply) => {
    const id = parse(z.string().uuid(), req.params.id, reply); if (!id) return;
    const body = parse(z.object({ status: z.enum(['new', 'handled', 'spam']) }), req.body, reply); if (!body) return;
    const before = (await q('SELECT status FROM contact_messages WHERE id = $1', [id])).rows[0];
    if (!before) return reply.code(404).send({ error: 'Enquiry not found.' });
    await q('UPDATE contact_messages SET status = $2 WHERE id = $1', [id, body.status]);
    await audit(q, req, 'enquiry.status', 'enquiry', id, { status: before.status }, { status: body.status });
    return { ok: true, status: body.status };
  });

  app.get('/api/admin/newsletter.csv', G('view'), async (req, reply) => {
    const { rows } = await q(
      `SELECT email, source, created_at FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at DESC LIMIT 10000`,
    );
    const lines = [['Email', 'Source', 'Subscribed at'].map(csvCell).join(',')];
    for (const r of rows) {
      lines.push([r.email, r.source, r.created_at ? new Date(r.created_at).toISOString() : ''].map(csvCell).join(','));
    }
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="newsletter-subscribers.csv"');
    return lines.join('\r\n');
  });
}
