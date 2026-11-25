// Website content: the scrolling announcement bar and the homepage, without touching code.
// Changes reach the site within about a minute (the site caches this content for 60 seconds).
import { useEffect, useMemo, useState } from 'react';
import { Megaphone, LayoutTemplate, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Save, Power, ExternalLink } from 'lucide-react';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, can, dt, useAction, useAdmin, useApi } from '../ui';

const SECTION_LABEL = {
  rich: 'Introduction (who we are)', products: 'Product cards (slider)', sep: 'Divider', banner: 'Banner image', benefits: 'Benefits',
  formulations: 'Formulations showcase', strip: 'Trust strip', story: 'Our story (image + text)', video: 'Background video', brands: 'Recognition logos', help: 'Help / contact',
};
const STATUS = { live: ['Showing', 'ok'], scheduled: ['Scheduled', 'info'], ended: ['Ended', 'off'], off: ['Off', 'off'] };
const toInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromInput = (v) => (v ? new Date(v).toISOString() : null);
const swap = (arr, i, j) => { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };

export default function WebsiteContent() {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/content');
  const edit = can(staff, 'products.edit');
  return (
    <>
      <PageHead title="Website content" sub="The announcement bar and the homepage. Changes show on the site within about a minute." />
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div className="adm-grid2 is-wide-left">
          <AnnouncementBar data={data} edit={edit} onChanged={reload} />
          <Homepage data={data} edit={edit} onChanged={reload} />
        </div>
      )}
    </>
  );
}

/* ---------------- announcement bar ---------------- */
function AnnouncementBar({ data, edit, onChanged }) {
  const [style, setStyle] = useState(data.style);
  const [editing, setEditing] = useState(null);       // null | 'new' | message
  const act = useAction();
  const fill = (t) => t.replaceAll('{free_shipping}', `₹${Math.round(data.tokens.free_shipping / 100).toLocaleString('en-IN')}`).replaceAll('{prepaid}', `${data.tokens.prepaid}%`);
  const showing = data.announcements.filter((a) => a.status === 'live');
  const saveStyle = async () => { if (await act.run(() => api('/api/admin/announcements/style', { method: 'PUT', body: style }), 'Bar colours saved.')) onChanged(); };
  const move = async (i, j) => {
    const ids = swap(data.announcements, i, j).map((a) => a.id);
    if (await act.run(() => api('/api/admin/announcements/order', { method: 'PUT', body: { ids } }))) onChanged();
  };
  const toggle = async (a) => { if (await act.run(() => api(`/api/admin/announcements/${a.id}`, { method: 'PATCH', body: { text: a.text, linkUrl: a.linkUrl, startsAt: a.startsAt, endsAt: a.endsAt, active: !a.active } }))) onChanged(); };
  const remove = async (a) => { if (confirm(`Remove "${a.text}"?`) && await act.run(() => api(`/api/admin/announcements/${a.id}`, { method: 'DELETE', body: {} }), 'Removed.')) onChanged(); };

  return (
    <section className="adm-card">
      <div className="adm-card__head">
        <h2 className="adm-h2"><Megaphone size={17} /> Announcement bar</h2>
        {edit && <button className="adm-btn is-sm" onClick={() => setEditing('new')}><Plus size={14} /> New message</button>}
      </div>

      <div className="adm-annbar" style={{ background: style.bg, color: style.fg }} aria-label="Preview of the bar">
        <div className="adm-annbar__track" style={{ animationDuration: { slow: '45s', normal: '30s', fast: '20s' }[style.speed] }}>
          {[0, 1].map((g) => <span key={g}>{(showing.length ? showing : [{ text: 'Live naturally. Live healthier.' }]).map((a) => fill(a.text)).join('   •   ')}   •   </span>)}
        </div>
      </div>
      <p className="adm-muted" style={{ marginTop: 6 }}>Preview of what visitors see now. Write <code>{'{free_shipping}'}</code> or <code>{'{prepaid}'}</code> to insert the live amounts from Settings.</p>

      {edit && (
        <div className="adm-pair" style={{ marginTop: 12, alignItems: 'end' }}>
          <label>Background<input type="color" value={style.bg} onChange={(e) => setStyle({ ...style, bg: e.target.value })} style={{ padding: 4, height: 40 }} /></label>
          <label>Text<input type="color" value={style.fg} onChange={(e) => setStyle({ ...style, fg: e.target.value })} style={{ padding: 4, height: 40 }} /></label>
          <label>Speed<select value={style.speed} onChange={(e) => setStyle({ ...style, speed: e.target.value })}><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
          <button className="adm-btn is-ghost is-sm" disabled={act.busy || JSON.stringify(style) === JSON.stringify(data.style)} onClick={saveStyle}><Save size={14} /> Save colours</button>
        </div>
      )}
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>

      {editing && <MessageForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onDone={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />}

      <ul className="adm-list" style={{ marginTop: 14 }}>
        {data.announcements.map((a, i) => (
          <li key={a.id} className="adm-offer">
            <div>
              <strong>{fill(a.text)}</strong> <span className={`adm-badge is-${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
              {a.linkUrl && <span className="adm-sub"><ExternalLink size={11} style={{ verticalAlign: -1 }} /> {a.linkUrl}</span>}
              {(a.startsAt || a.endsAt) && <span className="adm-sub">{a.startsAt ? dt(a.startsAt) : 'now'} → {a.endsAt ? dt(a.endsAt) : 'no end'}</span>}
            </div>
            {edit && (
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="adm-icon" aria-label="Move up" disabled={i === 0 || act.busy} onClick={() => move(i, i - 1)}><ArrowUp size={15} /></button>
                <button className="adm-icon" aria-label="Move down" disabled={i === data.announcements.length - 1 || act.busy} onClick={() => move(i, i + 1)}><ArrowDown size={15} /></button>
                <button className="adm-icon" aria-label={`Edit ${a.text}`} onClick={() => setEditing(a)}><Pencil size={15} /></button>
                <button className="adm-icon" aria-label={a.active ? 'Switch off' : 'Switch on'} title={a.active ? 'Switch off' : 'Switch on'} onClick={() => toggle(a)} disabled={act.busy}><Power size={15} /></button>
                <button className="adm-icon" aria-label={`Remove ${a.text}`} onClick={() => remove(a)} disabled={act.busy}><Trash2 size={15} /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MessageForm({ initial, onDone, onCancel }) {
  const [f, setF] = useState({ text: initial?.text || '', linkUrl: initial?.linkUrl || '', startsAt: toInput(initial?.startsAt), endsAt: toInput(initial?.endsAt), active: initial?.active ?? true });
  const act = useAction();
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    const body = { text: f.text.trim(), linkUrl: f.linkUrl.trim(), startsAt: fromInput(f.startsAt), endsAt: fromInput(f.endsAt), active: f.active };
    if (await act.run(() => api(initial ? `/api/admin/announcements/${initial.id}` : '/api/admin/announcements', { method: initial ? 'PATCH' : 'POST', body }))) onDone();
  };
  return (
    <form className="adm-form adm-offerform adm-card" style={{ marginTop: 14 }} onSubmit={submit}>
      <label>Message<span className="adm-sub">{f.text.length}/90</span><input value={f.text} onChange={(e) => set('text', e.target.value)} maxLength={90} placeholder="e.g. Diwali offer: 20% off Reviva" required /></label>
      <label>Link (optional)<span className="adm-sub">A page on this site like /shop or /products/reviva-roll-on, or a full https:// link</span><input value={f.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} maxLength={300} placeholder="/shop" /></label>
      <div className="adm-pair">
        <label>Show from (optional)<input type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></label>
        <label>Until (optional)<input type="datetime-local" value={f.endsAt} min={f.startsAt} onChange={(e) => set('endsAt', e.target.value)} /></label>
      </div>
      <label className="adm-check"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Switched on</label>
      <ErrorBox>{act.error}</ErrorBox>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="adm-btn" disabled={act.busy}>{initial ? 'Save message' : 'Add message'}</button>
        <button type="button" className="adm-btn is-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------------- homepage ---------------- */
function Homepage({ data, edit, onChanged }) {
  const [sections, setSections] = useState(data.sections);
  useEffect(() => setSections(data.sections), [data.sections]);
  const act = useAction();
  const dirty = useMemo(() => JSON.stringify(sections) !== JSON.stringify(data.sections), [sections, data.sections]);
  const products = data.products.filter((p) => p.active);
  const set = (i, k, v) => setSections((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    const body = { sections: sections.map((s) => (['products', 'formulations'].includes(s.key)
      ? { key: s.key, visible: s.visible, title: s.title, subtitle: s.subtitle, productIds: s.productIds }
      : { key: s.key, visible: s.visible })) };
    if (await act.run(() => api('/api/admin/home', { method: 'PUT', body }), 'Homepage saved.')) onChanged();
  };
  return (
    <section className="adm-card">
      <h2 className="adm-h2"><LayoutTemplate size={17} /> Homepage</h2>
      <p className="adm-muted" style={{ marginBottom: 12 }}>The hero always comes first. Reorder or hide the rest, and choose which products the product sections show.</p>
      <ol className="adm-list">
        {sections.map((s, i) => (
          <li key={s.key} className="adm-homesec" style={{ opacity: s.visible ? 1 : 0.55 }}>
            <div className="adm-row">
              <span><b className="tabular" style={{ color: 'var(--muted)', marginRight: 8 }}>{i + 1}</b>{SECTION_LABEL[s.key] || s.key}</span>
              {edit && (
                <span style={{ display: 'flex', gap: 2 }}>
                  <button className="adm-icon" aria-label={`Move ${SECTION_LABEL[s.key]} up`} disabled={i === 0} onClick={() => setSections(swap(sections, i, i - 1))}><ArrowUp size={15} /></button>
                  <button className="adm-icon" aria-label={`Move ${SECTION_LABEL[s.key]} down`} disabled={i === sections.length - 1} onClick={() => setSections(swap(sections, i, i + 1))}><ArrowDown size={15} /></button>
                  <button className="adm-icon" aria-label={s.visible ? `Hide ${SECTION_LABEL[s.key]}` : `Show ${SECTION_LABEL[s.key]}`} title={s.visible ? 'Hide' : 'Show'} onClick={() => set(i, 'visible', !s.visible)}>{s.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                </span>
              )}
            </div>
            {['products', 'formulations'].includes(s.key) && s.visible && (
              <div className="adm-form" style={{ marginTop: 8 }}>
                {s.key === 'products' && (
                  <div className="adm-pair">
                    <label>Heading<input value={s.title} maxLength={60} onChange={(e) => set(i, 'title', e.target.value)} disabled={!edit} /></label>
                    <label>Line under it<input value={s.subtitle} maxLength={140} onChange={(e) => set(i, 'subtitle', e.target.value)} disabled={!edit} /></label>
                  </div>
                )}
                <ProductOrder ids={s.productIds} products={products} disabled={!edit} onChange={(ids) => set(i, 'productIds', ids)} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
      {edit && <button className="adm-btn" style={{ marginTop: 12 }} disabled={!dirty || act.busy} onClick={save}><Save size={15} /> Save homepage</button>}
    </section>
  );
}

/** Which products, in which order. Empty = all products in the shop order. */
function ProductOrder({ ids, products, disabled, onChange }) {
  const all = !ids.length;
  const chosen = all ? products.map((p) => p.id) : ids;
  const name = (id) => products.find((p) => p.id === id)?.short || id;
  return (
    <div className="adm-fieldset" style={{ border: 'none', padding: 0 }}>
      <label className="adm-check"><input type="checkbox" checked={all} disabled={disabled} onChange={(e) => onChange(e.target.checked ? [] : products.map((p) => p.id))} /> All products, in the shop order</label>
      {!all && (
        <>
          <ol className="adm-list">{chosen.map((id, k) => (
            <li key={id} className="adm-row" style={{ padding: '4px 0' }}>
              <span>{k + 1}. {name(id)}</span>
              <span style={{ display: 'flex', gap: 2 }}>
                <button type="button" className="adm-icon" aria-label={`Move ${name(id)} up`} disabled={disabled || k === 0} onClick={() => onChange(swap(chosen, k, k - 1))}><ArrowUp size={14} /></button>
                <button type="button" className="adm-icon" aria-label={`Move ${name(id)} down`} disabled={disabled || k === chosen.length - 1} onClick={() => onChange(swap(chosen, k, k + 1))}><ArrowDown size={14} /></button>
                <button type="button" className="adm-icon" aria-label={`Remove ${name(id)}`} disabled={disabled || chosen.length === 1} onClick={() => onChange(chosen.filter((x) => x !== id))}><Trash2 size={14} /></button>
              </span>
            </li>
          ))}</ol>
          {products.some((p) => !chosen.includes(p.id)) && (
            <select value="" disabled={disabled} onChange={(e) => e.target.value && onChange([...chosen, e.target.value])} aria-label="Add a product">
              <option value="">+ Add a product…</option>
              {products.filter((p) => !chosen.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.short || p.name}</option>)}
            </select>
          )}
        </>
      )}
    </div>
  );
}
