// One date-range definition for every admin report (Home, Sales analytics, Visitors), in India time.
//   ?range=today | 7d | 30d | 90d | 365d | month | custom (&from=YYYY-MM-DD&to=YYYY-MM-DD)
// "previous" is the period of the same length just before (for "▲ 12% vs previous").
// `unit` is the chart bucket: hour (one day), day (up to a month), week (up to ~4 months), month.

export const RANGE_KEYS = ['today', '7d', '30d', '90d', '365d', 'month', 'custom'];
const DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
const IST = `'Asia/Kolkata'`;
const ymd = /^\d{4}-\d{2}-\d{2}$/;

export const unitFor = (days) => (days <= 1 ? 'hour' : days <= 31 ? 'day' : days <= 120 ? 'week' : 'month');

export async function resolveRange(db, query = {}, fallback = '30d') {
  let key = RANGE_KEYS.includes(query.range) ? query.range : fallback;
  if (key === 'custom') {
    const { from, to } = query;
    if (ymd.test(from || '') && ymd.test(to || '') && from <= to) {
      const b = (await db.query(`
        SELECT ($1::date)::timestamp AT TIME ZONE ${IST} AS cur_from,
               LEAST(($2::date + 1)::timestamp AT TIME ZONE ${IST}, now()) AS cur_to,
               ($2::date - $1::date + 1) AS days`, [from, to])).rows[0];
      const days = Number(b.days);
      if (days >= 1 && days <= 366) {
        const p = (await db.query(`SELECT $1::timestamptz - make_interval(days => $2) AS prev_from`, [b.cur_from, days])).rows[0];
        return { key, days, unit: unitFor(days), from: b.cur_from, to: b.cur_to, prevFrom: p.prev_from, prevTo: b.cur_from, fromDate: from, toDate: to };
      }
    }
    key = fallback;
  }
  if (key === 'month') {
    // this calendar month so far, compared with the same number of days at the start of last month
    const b = (await db.query(`
      SELECT date_trunc('month', now() AT TIME ZONE ${IST}) AT TIME ZONE ${IST} AS cur_from, now() AS cur_to,
             (date_trunc('month', now() AT TIME ZONE ${IST}) - interval '1 month') AT TIME ZONE ${IST} AS prev_from,
             now() - interval '1 month' AS prev_to,
             EXTRACT(day FROM now() AT TIME ZONE ${IST})::int AS days`)).rows[0];
    return { key, days: b.days, unit: unitFor(b.days), from: b.cur_from, to: b.cur_to, prevFrom: b.prev_from, prevTo: b.prev_to };
  }
  const days = DAYS[key];
  // "today" = since midnight; others = the last N whole days including today
  const b = (await db.query(`
    SELECT (date_trunc('day', now() AT TIME ZONE ${IST}) - make_interval(days => $1 - 1)) AT TIME ZONE ${IST} AS cur_from, now() AS cur_to,
           (date_trunc('day', now() AT TIME ZONE ${IST}) - make_interval(days => 2 * $1 - 1)) AT TIME ZONE ${IST} AS prev_from,
           now() - make_interval(days => $1) AS prev_to`, [days])).rows[0];
  return { key, days, unit: unitFor(days), from: b.cur_from, to: b.cur_to, prevFrom: b.prev_from, prevTo: b.prev_to };
}
