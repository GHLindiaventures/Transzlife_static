import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, dt, useAction, useApi } from '../ui';

const STATUS_META = {
  ok: { label: 'OK', cls: 'is-ok', Icon: CheckCircle2, color: '#166534' },
  warn: { label: 'Warning', cls: 'is-warn', Icon: AlertTriangle, color: '#b45309' },
  error: { label: 'Problem', cls: 'is-bad', Icon: XCircle, color: '#b91c1c' },
};

const GROUPS = [
  ['availability', 'Availability'],
  ['uptime', 'Uptime'],
  ['services', 'Services'],
  ['ssl', 'SSL'],
  ['jobs', 'Jobs'],
  ['security', 'Security'],
  ['links', 'Links'],
  ['data', 'Data'],
  ['speed', 'Speed'],
];

function StatusDot({ status }) {
  const m = STATUS_META[status] || STATUS_META.ok;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: m.color, fontWeight: 700, fontSize: 13 }}>
      <m.Icon size={15} /> {m.label}
    </span>
  );
}

function fmtUptime(sec = 0) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function SystemHealth() {
  const { data, error, setData } = useApi('/api/admin/health');
  const act = useAction();
  const [group, setGroup] = useState('');

  const runNow = () =>
    act.run(async () => {
      const fresh = await api('/api/admin/health/run', { method: 'POST', body: {} });
      setData(fresh);
    }, 'All system health checks completed.');

  const overall = data?.overall || 'ok';
  const overallText = overall === 'error' ? 'Action needed' : overall === 'warn' ? 'Warnings present' : 'All systems normal';
  const checks = (data?.checks || []).filter((c) => !group || c.group_key === group);

  // Worst status per group for quick summary pills
  const groupStatus = (key) => {
    const list = (data?.checks || []).filter((c) => c.group_key === key);
    if (list.some((c) => c.status === 'error')) return 'error';
    if (list.some((c) => c.status === 'warn')) return 'warn';
    return 'ok';
  };

  return (
    <>
      <PageHead
        title="System health"
        sub={data ? `${overallText} · Last checked ${dt(data.checkedAt)} · Node ${data.server.nodeVersion} · ${data.server.memoryMb} MB RAM · Up ${fmtUptime(data.server.uptimeSeconds)}` : 'Monitoring availability, services, security, jobs, and data health.'}
      >
        <button type="button" className="adm-btn" onClick={runNow} disabled={act.busy}>
          <RefreshCw size={15} className={act.busy ? 'spin' : ''} /> {act.busy ? 'Running…' : 'Run checks now'}
        </button>
      </PageHead>

      <ErrorBox>{error || act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      {!data ? <Loading /> : (
        <>
          {/* Group summary pills */}
          <div className="adm-filters" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button type="button" className={`adm-btn is-sm ${!group ? '' : 'is-ghost'}`} onClick={() => setGroup('')}>
              All ({data.checks.length})
            </button>
            {GROUPS.map(([key, label]) => {
              const st = groupStatus(key);
              const m = STATUS_META[st];
              return (
                <button
                  key={key}
                  type="button"
                  className={`adm-btn is-sm ${group === key ? '' : 'is-ghost'}`}
                  onClick={() => setGroup(group === key ? '' : key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* 24h Response time & Recent incidents */}
          <div className="adm-grid2" style={{ marginBottom: 16 }}>
            <section className="adm-card">
              <h2 className="adm-h2">Response time &amp; errors (24 h)</h2>
              <p className="adm-muted" style={{ marginBottom: 12 }}>
                p50: <strong>{data.metrics.p50}ms</strong> · p95: <strong>{data.metrics.p95}ms</strong> · Errors: <strong>{data.metrics.errors}</strong> ({data.metrics.errorRatePct}%) across {data.metrics.total} requests
              </p>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.metrics.buckets}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={3} />
                    <YAxis tick={{ fontSize: 11 }} width={38} unit="ms" />
                    <Tooltip formatter={(val, name) => [name === 'avgMs' ? `${val} ms` : val, name === 'avgMs' ? 'Avg latency' : '5xx errors']} />
                    <Area type="monotone" dataKey="avgMs" stroke="#173f24" fill="rgba(23,63,36,0.14)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="adm-card">
              <h2 className="adm-h2">Recent incidents</h2>
              {data.incidents.length === 0 ? (
                <p className="adm-muted">No incidents recorded yet. All checks have stayed green.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {data.incidents.slice(0, 6).map((inc) => (
                    <li key={inc.id} style={{ paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <StatusDot status={inc.resolved_at ? 'ok' : inc.status} />
                        <span className="adm-muted" style={{ fontSize: 12 }}>
                          {inc.resolved_at ? `Resolved ${dt(inc.resolved_at)}` : `Active since ${dt(inc.started_at)}`}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{inc.label}</div>
                      <div className="adm-muted" style={{ fontSize: 13 }}>{inc.summary}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Checks table */}
          <section className="adm-card is-flush" style={{ marginBottom: 16 }}>
            <div style={{ padding: '16px 20px 8px' }}>
              <h2 className="adm-h2">Health checks</h2>
            </div>
            <table className="adm-table is-compact">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Last checked</th>
                  <th>7-day history</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.check_key}>
                    <td><strong>{c.label}</strong></td>
                    <td><StatusDot status={c.status} /></td>
                    <td style={{ maxWidth: 420 }}>{c.summary}</td>
                    <td className="adm-muted">{dt(c.checked_at)}</td>
                    <td>
                      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }} title="Last 7 days">
                        {(c.history7d || []).length === 0 ? (
                          <span className="adm-muted" style={{ fontSize: 12 }}>Today</span>
                        ) : (
                          c.history7d.map((h) => (
                            <span
                              key={h.day}
                              title={`${h.day}: ${h.status}`}
                              style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: (STATUS_META[h.status] || STATUS_META.ok).color,
                                display: 'inline-block',
                              }}
                            />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Recent server errors (no personal data) */}
          <section className="adm-card is-flush">
            <div style={{ padding: '16px 20px 8px' }}>
              <h2 className="adm-h2">Recent server errors (14-day log, no personal data)</h2>
            </div>
            {data.errors.length === 0 ? (
              <p className="adm-muted adm-pad">No 5xx server errors logged in the last 14 days.</p>
            ) : (
              <table className="adm-table is-compact">
                <thead><tr><th>When</th><th>Method</th><th>Route</th><th>Status</th><th>Message</th></tr></thead>
                <tbody>
                  {data.errors.map((e) => (
                    <tr key={e.id}>
                      <td className="adm-muted">{dt(e.created_at)}</td>
                      <td><code>{e.method}</code></td>
                      <td><code>{e.route}</code></td>
                      <td><strong>{e.status_code}</strong></td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}
