// Product editor: basics, photos, pricing, stock & batches, ingredients, page copy, label details.
// One "Save changes" for the text fields (sticky bar appears when something changed); photos and
// batches save immediately. Everything is checked again on the server and written to the activity log.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Upload, Trash2, ArrowUp, ArrowDown, Star, Plus, X, Leaf, PackagePlus, Users, Ban, Info, CheckCircle2, Circle,
} from 'lucide-react';
import { api } from '../../store/lib/api';
import { CONCERNS } from '../../store/data/concerns';
import { ErrorBox, Loading, Notice, can, d, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';
import { Completeness } from './Products';

const TABS = [['basics', 'Basics'], ['photos', 'Photos'], ['pricing', 'Pricing'], ['stock', 'Stock & batches'], ['ingredients', 'Ingredients'], ['content', 'Product page'], ['label', 'Label & compliance']];
const CERTS = ['AYUSH GMP', 'ISO 9001:2015', 'ISO 22000', 'FSSAI licensed', 'WHO-GMP', 'Vegan', 'Gluten free', 'Cruelty free', 'Halal'];
const PACKS = [[1, 0], [2, 5], [3, 10]];

const toForm = (p) => ({
  name: p.name, short: p.short, tagline: p.tagline, format: p.format, size: p.size, badge: p.badge || '',
  accent: p.accent || '#1f6b3c', tint: p.tint || '#eef4ea', concerns: p.concerns || [], sortOrder: p.sortOrder,
  price: p.price / 100, mrp: p.mrp / 100, gstRate: p.gstRate ?? '', hsnCode: p.hsnCode || '', lowStockAt: p.lowStockAt,
  returnable: p.returnable !== false, returnDays: p.returnDays ?? '',
  content: {
    summary: '', highlights: [], description: [], benefits: [], routine: [], howToUse: [], whoFor: [], precautions: [], faqs: [], ingredients: [], ...p.content,
  },
  compliance: { netQuantity: '', manufacturer: '', manufacturerAddress: '', licenceNo: '', countryOfOrigin: 'India', shelfLifeMonths: '', storage: '', consumerCare: '', certifications: [], ...p.compliance },
});

function toPatch(f) {
  const clean = (a) => a.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => (Array.isArray(x) ? x[0]?.trim() && x[1]?.trim() : typeof x === 'object' ? x.label?.trim() && x.value?.trim() : x));
  const c = f.content, k = f.compliance;
  return {
    name: f.name.trim(), short: f.short.trim(), tagline: f.tagline.trim(), format: f.format.trim(), size: f.size.trim(),
    accent: f.accent, tint: f.tint, concerns: f.concerns, sortOrder: Number(f.sortOrder) || 0,
    price: toPaise(f.price), mrp: toPaise(f.mrp), gstRate: f.gstRate === '' ? null : Number(f.gstRate), hsnCode: f.hsnCode.trim() || null,
    lowStockAt: Number(f.lowStockAt) || 0,
    returnable: !!f.returnable, returnDays: f.returnDays === '' ? null : Number(f.returnDays),
    content: {
      summary: c.summary.trim(), highlights: clean(c.highlights), description: clean(c.description), benefits: clean(c.benefits),
      routine: clean(c.routine), howToUse: clean(c.howToUse), whoFor: clean(c.whoFor), precautions: clean(c.precautions),
      faqs: clean(c.faqs), ingredients: c.ingredients,
    },
    compliance: { ...k, shelfLifeMonths: k.shelfLifeMonths === '' ? null : Number(k.shelfLifeMonths) },
  };
}

export default function ProductEditor() {
  const { id } = useParams();
  const { staff } = useAdmin();
  const { data, error, reload } = useApi(`/api/admin/products/${id}`);
  const [tab, setTab] = useState('basics');
  const [form, setForm] = useState(null);
  const saved = useRef(null);
  const act = useAction();
  const editable = can(staff, 'products.edit');

  useEffect(() => { if (data) { const f = toForm(data.product); setForm(f); saved.current = JSON.stringify(f); } }, [data]);
  const dirty = form && JSON.stringify(form) !== saved.current;
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!form || !dirty) return;
    const r = await act.run(() => api(`/api/admin/products/${id}`, { method: 'PATCH', body: toPatch(form) }), 'Saved. The shop shows the changes right away.');
    if (r) reload();
  }, [form, dirty, id, act, reload]);
  useEffect(() => {
    const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [save]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data || !form) return <Loading />;
  const p = data.product;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setC = (k, v) => setForm((f) => ({ ...f, content: { ...f.content, [k]: v } }));
  const setK = (k, v) => setForm((f) => ({ ...f, compliance: { ...f.compliance, [k]: v } }));
  const toggleActive = async () => {
    if (dirty && !window.confirm('You have unsaved changes. Switch visibility anyway? (Your other edits stay unsaved.)')) return;
    const r = await act.run(() => api(`/api/admin/products/${id}`, { method: 'PATCH', body: { active: !p.active } }), p.active ? 'Hidden from the shop.' : 'Now on sale in the shop.');
    if (r) reload();
  };

  return (
    <>
      <Link to="/admin/products" className="adm-link adm-back"><ArrowLeft size={15} /> Products</Link>
      <div className="adm-head">
        <div className="adm-ehead">
          <span className="adm-ehead__img">{data.media[0] ? <img src={data.media[0].thumb_url || data.media[0].url} alt="" /> : <Leaf size={28} strokeWidth={1.3} />}</span>
          <div>
            <h1>{p.name}</h1>
            <p className="adm-muted">{[p.format, p.size].filter(Boolean).join(' · ')} · {rs(p.price)} · {p.available} available</p>
          </div>
        </div>
        <div className="adm-head__actions">
          {p.active && <a className="adm-btn is-ghost" href={`/products/${p.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View on shop</a>}
          {editable && <button className={`adm-btn ${p.active ? 'is-ghost' : 'is-gold'}`} onClick={toggleActive} disabled={act.busy}>{p.active ? 'Hide from shop' : 'Put on sale'}</button>}
        </div>
      </div>
      <ErrorBox>{act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>

      <section className="adm-card adm-checklist">
        <div className="adm-row">
          <div><h2 className="adm-h2" style={{ margin: 0 }}>Listing completeness</h2><p className="adm-muted">Complete listings sell better and show customers everything the label must declare.</p></div>
          <Completeness score={data.completeness.score} size="lg" />
        </div>
        {data.completeness.missing.length > 0 && (
          <ul className="adm-todo">{data.completeness.missing.map((m) => <li key={m}><Circle size={14} /> {m}</li>)}</ul>
        )}
        {data.completeness.missing.length === 0 && <p className="adm-muted" style={{ marginTop: 8 }}><CheckCircle2 size={15} className="is-ok" style={{ verticalAlign: '-3px' }} /> Everything is filled in.</p>}
      </section>

      <div className="adm-tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={`adm-tab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>{label}{k === 'photos' && <b>{data.media.length}</b>}{k === 'stock' && <b>{data.batches.filter((b) => b.qty_remaining > 0 && !b.written_off_at).length}</b>}</button>)}
      </div>

      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {tab === 'basics' && <Basics form={form} set={set} />}
        {tab === 'pricing' && <Pricing form={form} set={set} />}
        {tab === 'ingredients' && <Ingredients value={form.content.ingredients} onChange={(v) => setC('ingredients', v)} />}
        {tab === 'content' && <Content c={form.content} setC={setC} />}
        {tab === 'label' && <Label k={form.compliance} setK={setK} />}
      </fieldset>
      {tab === 'photos' && <Photos productId={id} media={data.media} editable={editable} onChange={reload} />}
      {tab === 'stock' && <Stock data={data} form={form} set={set} staff={staff} onChange={reload} />}

      {dirty && (
        <div className="adm-bulk adm-savebar" role="region" aria-label="Unsaved changes">
          <strong>You have unsaved changes</strong>
          <button className="adm-btn is-ghost is-sm" onClick={() => setForm(JSON.parse(saved.current))}>Discard</button>
          <button className="adm-btn is-gold is-sm" onClick={save} disabled={act.busy}>{act.busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      )}
    </>
  );
}

// ---- tabs -------------------------------------------------------------------
function Basics({ form, set }) {
  const toggle = (id) => set('concerns', form.concerns.includes(id) ? form.concerns.filter((c) => c !== id) : [...form.concerns, id]);
  return (
    <div className="adm-grid2">
      <section className="adm-card adm-form">
        <h2 className="adm-h2">Name & description</h2>
        <label>Product name<input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required /></label>
        <label>Short name<span className="adm-sub">Used on cards and in the cart</span><input value={form.short} onChange={(e) => set('short', e.target.value)} maxLength={60} /></label>
        <label>Tagline<span className="adm-sub">One line under the name on the product page</span><input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={160} /></label>
        <div className="adm-pair">
          <label>Format<input value={form.format} onChange={(e) => set('format', e.target.value)} maxLength={40} placeholder="e.g. Gummies" /></label>
          <label>Pack size<input value={form.size} onChange={(e) => set('size', e.target.value)} maxLength={40} placeholder="e.g. 30 Gummies" /></label>
        </div>
      </section>
      <section className="adm-card adm-form">
        <h2 className="adm-h2">Shop by concern</h2>
        <p className="adm-muted">Which "Shop by concern" pages this product appears on.</p>
        <div className="adm-chips">{CONCERNS.map((c) => <button type="button" key={c.id} className={`adm-chip ${form.concerns.includes(c.id) ? 'is-on' : ''}`} aria-pressed={form.concerns.includes(c.id)} onClick={() => toggle(c.id)}>{c.title}</button>)}</div>
        <h2 className="adm-h2" style={{ marginTop: 8 }}>Look on the shop</h2>
        <div className="adm-pair">
          <div className="adm-field-note"><span className="adm-label">Badge</span><span className="adm-sub">Badges (Hot deal, New arrival, automatic Best seller…) and offers are set in <Link to="/admin/pricing">Pricing &amp; offers</Link>.</span></div>
          <label>Position in the shop<span className="adm-sub">Lower numbers show first</span><input type="number" min="0" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></label>
        </div>
        <div className="adm-pair">
          <label>Accent colour<input type="color" value={form.accent} onChange={(e) => set('accent', e.target.value)} style={{ padding: 4, height: 42 }} /></label>
          <label>Background tint<input type="color" value={form.tint} onChange={(e) => set('tint', e.target.value)} style={{ padding: 4, height: 42 }} /></label>
        </div>
      </section>
    </div>
  );
}

function Pricing({ form, set }) {
  const price = Number(form.price) || 0, mrp = Number(form.mrp) || 0;
  const over = price > mrp;
  return (
    <div className="adm-grid2">
      <section className="adm-card adm-form">
        <h2 className="adm-h2">Price</h2>
        <div className="adm-pair">
          <label>Selling price (₹)<input type="number" min="1" step="1" value={form.price} onChange={(e) => set('price', e.target.value)} required /></label>
          <label>MRP (₹)<span className="adm-sub">As printed on the pack</span><input type="number" min="1" step="1" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} required /></label>
        </div>
        {over ? <p className="adm-error" style={{ margin: 0 }}>The selling price cannot be more than the MRP.</p>
          : <p className="adm-muted">{price < mrp ? `Shows as ${Math.round((1 - price / mrp) * 100)}% off MRP on the shop.` : 'Sold at MRP (no discount shown).'}</p>}
        <div className="adm-pair">
          <label>GST rate (%)<input type="number" min="0" max="28" step="0.01" value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)} placeholder="e.g. 12" /></label>
          <label>HSN code<input inputMode="numeric" maxLength={8} value={form.hsnCode} onChange={(e) => set('hsnCode', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 30049011" /></label>
        </div>
      </section>
      <section className="adm-card">
        <h2 className="adm-h2">What customers pay</h2>
        <table className="adm-table is-compact">
          <thead><tr><th>Pack</th><th className="num">Price</th><th className="num">Prepaid (−5%)</th></tr></thead>
          <tbody>{PACKS.map(([n, off]) => { const v = Math.round(price * n * (1 - off / 100)); return <tr key={n}><td>Pack of {n}{off ? <span className="adm-sub">{off}% pack saving</span> : null}</td><td className="num">₹{v.toLocaleString('en-IN')}</td><td className="num">₹{(v - Math.round(v * 0.05)).toLocaleString('en-IN')}</td></tr>; })}</tbody>
        </table>
        <p className="adm-muted" style={{ marginTop: 10 }}>Pack savings, the prepaid discount and shipping are set in Settings and apply to every product.</p>
      </section>
    </div>
  );
}

function Ingredients({ value, onChange }) {
  const { data } = useApi('/api/admin/ingredients');
  const [q, setQ] = useState('');
  const all = data?.ingredients || [];
  const byId = useMemo(() => Object.fromEntries(all.map((i) => [i.id, i])), [all]);
  const list = all.filter((i) => !value.includes(i.id) && (!q || `${i.name} ${i.latin}`.toLowerCase().includes(q.toLowerCase())));
  const move = (i, dir) => { const v = [...value]; [v[i], v[i + dir]] = [v[i + dir], v[i]]; onChange(v); };
  return (
    <div className="adm-grid2">
      <section className="adm-card">
        <h2 className="adm-h2">In this product <span className="adm-muted">({value.length})</span></h2>
        <p className="adm-muted" style={{ marginBottom: 10 }}>Shown on the product page in this order, with photos and notes from the ingredient library.</p>
        {value.length === 0 ? <p className="adm-muted">None yet: pick from the library.</p> : (
          <ul className="adm-list">{value.map((id, i) => (
            <li key={id} className="adm-ingr">
              <Leaf size={16} className="is-ok" /><span><strong>{byId[id]?.name || id}</strong><span className="adm-sub">{byId[id]?.latin}{byId[id]?.part ? ` · ${byId[id].part}` : ''}</span></span>
              <button type="button" className="adm-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
              <button type="button" className="adm-icon" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
              <button type="button" className="adm-icon" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remove ${byId[id]?.name || id}`}><X size={15} /></button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="adm-card">
        <h2 className="adm-h2">Ingredient library</h2>
        <input type="search" placeholder="Search by name or Latin name" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} aria-label="Search ingredients" />
        <ul className="adm-list is-scroll" style={{ maxHeight: 420 }}>{list.map((i) => (
          <li key={i.id}><button type="button" className="adm-result" onClick={() => onChange([...value, i.id])}><Plus size={15} /><span><strong>{i.name}</strong><span className="adm-sub">{i.latin}{i.part ? ` · ${i.part}` : ''}</span></span></button></li>
        ))}</ul>
      </section>
    </div>
  );
}

/** Editable list of short texts (highlights, benefits, steps…). */
function ListField({ label, help, items, onChange, max, placeholder, multiline }) {
  const upd = (i, v) => onChange(items.map((x, k) => (k === i ? v : x)));
  return (
    <div className="adm-listfield">
      <div className="adm-row"><span className="adm-listfield__label">{label}</span>{items.length < max && <button type="button" className="adm-link" onClick={() => onChange([...items, ''])}><Plus size={14} /> Add</button>}</div>
      {help && <span className="adm-sub">{help}</span>}
      {items.map((v, i) => (
        <div key={i} className="adm-listfield__row">
          {multiline ? <textarea rows={3} value={v} onChange={(e) => upd(i, e.target.value)} placeholder={placeholder} /> : <input value={v} onChange={(e) => upd(i, e.target.value)} placeholder={placeholder} />}
          <button type="button" className="adm-icon" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

function Content({ c, setC }) {
  return (
    <div className="adm-grid2">
      <section className="adm-card adm-form">
        <h2 className="adm-h2">Overview</h2>
        <label>Summary<span className="adm-sub">2–3 sentences at the top of the product page ({c.summary.length}/600)</span><textarea rows={4} maxLength={600} value={c.summary} onChange={(e) => setC('summary', e.target.value)} /></label>
        <ListField label="Highlights" help="Short points shown as chips (3–5 works best)" items={c.highlights} onChange={(v) => setC('highlights', v)} max={8} placeholder="e.g. 9 Ayurvedic botanicals" />
        <ListField label="Description paragraphs" items={c.description} onChange={(v) => setC('description', v)} max={6} multiline />
        <ListField label="Benefits" items={c.benefits} onChange={(v) => setC('benefits', v)} max={10} placeholder="e.g. Supports everyday liver wellness" />
        <p className="adm-muted"><Info size={13} style={{ verticalAlign: '-2px' }} /> Use wellness-support wording ("supports", "traditionally used for"). Avoid "cures" or "treats".</p>
      </section>
      <section className="adm-card adm-form">
        <h2 className="adm-h2">How to use & safety</h2>
        <div className="adm-listfield">
          <div className="adm-row"><span className="adm-listfield__label">Routine (quick facts)</span>{c.routine.length < 6 && <button type="button" className="adm-link" onClick={() => setC('routine', [...c.routine, { label: '', value: '' }])}><Plus size={14} /> Add</button>}</div>
          {c.routine.map((r, i) => (
            <div key={i} className="adm-listfield__row">
              <input value={r.label} onChange={(e) => setC('routine', c.routine.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder="Dose" style={{ maxWidth: 130 }} />
              <input value={r.value} onChange={(e) => setC('routine', c.routine.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} placeholder="10 ml" />
              <button type="button" className="adm-icon" onClick={() => setC('routine', c.routine.filter((_, k) => k !== i))} aria-label="Remove"><X size={15} /></button>
            </div>
          ))}
        </div>
        <ListField label="How to use (steps)" items={c.howToUse} onChange={(v) => setC('howToUse', v)} max={10} />
        <ListField label="Who it's for" items={c.whoFor} onChange={(v) => setC('whoFor', v)} max={8} />
        <ListField label="Precautions" items={c.precautions} onChange={(v) => setC('precautions', v)} max={12} />
      </section>
      <section className="adm-card adm-form" style={{ gridColumn: '1 / -1' }}>
        <div className="adm-row"><h2 className="adm-h2" style={{ margin: 0 }}>FAQs</h2>{c.faqs.length < 15 && <button type="button" className="adm-link" onClick={() => setC('faqs', [...c.faqs, ['', '']])}><Plus size={14} /> Add question</button>}</div>
        {c.faqs.map(([q, a], i) => (
          <div key={i} className="adm-faq">
            <input value={q} onChange={(e) => setC('faqs', c.faqs.map((x, k) => (k === i ? [e.target.value, x[1]] : x)))} placeholder="Question" />
            <textarea rows={2} value={a} onChange={(e) => setC('faqs', c.faqs.map((x, k) => (k === i ? [x[0], e.target.value] : x)))} placeholder="Answer" />
            <button type="button" className="adm-icon" onClick={() => setC('faqs', c.faqs.filter((_, k) => k !== i))} aria-label="Remove question"><Trash2 size={15} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Label({ k, setK }) {
  const toggle = (c) => setK('certifications', k.certifications.includes(c) ? k.certifications.filter((x) => x !== c) : [...k.certifications, c]);
  return (
    <div className="adm-grid2">
      <section className="adm-card adm-form">
        <h2 className="adm-h2">Label declarations</h2>
        <p className="adm-muted">Indian rules for selling online require these on the product page. Copy them from the printed label.</p>
        <div className="adm-pair">
          <label>Net quantity<input value={k.netQuantity} onChange={(e) => setK('netQuantity', e.target.value)} maxLength={60} placeholder="e.g. 500 ml" /></label>
          <label>Country of origin<input value={k.countryOfOrigin} onChange={(e) => setK('countryOfOrigin', e.target.value)} maxLength={60} /></label>
        </div>
        <label>Manufactured by<input value={k.manufacturer} onChange={(e) => setK('manufacturer', e.target.value)} maxLength={120} placeholder="Company name" /></label>
        <label>Manufacturer address<textarea rows={2} value={k.manufacturerAddress} onChange={(e) => setK('manufacturerAddress', e.target.value)} maxLength={300} /></label>
        <div className="adm-pair">
          <label>Manufacturing licence no.<input value={k.licenceNo} onChange={(e) => setK('licenceNo', e.target.value)} maxLength={80} placeholder="e.g. AYUSH licence" /></label>
          <label>Shelf life (months)<input type="number" min="1" max="120" value={k.shelfLifeMonths ?? ''} onChange={(e) => setK('shelfLifeMonths', e.target.value)} /></label>
        </div>
        <label>Storage<input value={k.storage} onChange={(e) => setK('storage', e.target.value)} maxLength={200} placeholder="e.g. Store below 30°C, away from sunlight" /></label>
        <label>Consumer care<input value={k.consumerCare} onChange={(e) => setK('consumerCare', e.target.value)} maxLength={200} placeholder="e.g. care@tranzlife.in · +91 91503 94443" /></label>
      </section>
      <section className="adm-card">
        <h2 className="adm-h2">Certifications</h2>
        <p className="adm-muted" style={{ marginBottom: 10 }}>Only tick what this product actually holds.</p>
        <div className="adm-chips">{CERTS.map((c) => <button type="button" key={c} className={`adm-chip ${k.certifications.includes(c) ? 'is-on' : ''}`} aria-pressed={k.certifications.includes(c)} onClick={() => toggle(c)}>{c}</button>)}</div>
        <p className="adm-muted" style={{ marginTop: 10 }}>The batch number, manufacturing date and expiry come from Stock & batches.</p>
      </section>
    </div>
  );
}

// ---- photos (save immediately) ------------------------------------------------
function Photos({ productId, media, editable, onChange }) {
  const act = useAction();
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);
  const upload = async (files) => {
    const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (!list.length) { act.setError('Choose JPG, PNG or WebP photos.'); return; }
    act.setError(''); act.setNotice('');
    for (const [i, f] of list.entries()) {
      if (f.size > 10 * 1024 * 1024) { act.setError(`${f.name} is larger than 10 MB.`); continue; }
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const res = await fetch(`/api/admin/products/${productId}/media`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': f.type }, body: f });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Upload failed.');
      } catch (e) { act.setError(`${f.name}: ${e.message}`); }
    }
    setProgress(null);
    onChange();
  };
  const reorder = (i, dir) => {
    const ids = media.map((m) => m.id); [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    act.run(() => api(`/api/admin/products/${productId}/media`, { method: 'PATCH', body: { order: ids } })).then((r) => r && onChange());
  };
  const cover = (i) => { const ids = media.map((m) => m.id); ids.unshift(ids.splice(i, 1)[0]); act.run(() => api(`/api/admin/products/${productId}/media`, { method: 'PATCH', body: { order: ids } }), 'Cover photo updated.').then((r) => r && onChange()); };
  const remove = async (m) => { if (!window.confirm('Delete this photo?')) return; const r = await act.run(() => api(`/api/admin/products/${productId}/media/${m.id}`, { method: 'DELETE', body: {} }), 'Photo deleted.'); if (r) onChange(); };
  return (
    <section className="adm-card">
      <div className="adm-card__head"><div><h2 className="adm-h2">Photos</h2><p className="adm-muted">The first photo is the cover. Square photos on a plain background look best. Up to 12.</p></div></div>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
      <div className="adm-photos">
        {media.map((m, i) => (
          <figure key={m.id} className="adm-photo">
            <img src={m.thumb_url || m.url} alt={m.alt || ''} loading="lazy" />
            {i === 0 && <span className="adm-badge is-go adm-photo__cover">Cover</span>}
            {editable && (
              <figcaption>
                <button className="adm-icon" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move left"><ArrowUp size={15} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button className="adm-icon" disabled={i === media.length - 1} onClick={() => reorder(i, 1)} aria-label="Move right"><ArrowDown size={15} style={{ transform: 'rotate(-90deg)' }} /></button>
                {i > 0 && <button className="adm-icon" onClick={() => cover(i)} aria-label="Make cover photo" title="Make cover"><Star size={15} /></button>}
                <button className="adm-icon" onClick={() => remove(m)} aria-label="Delete photo"><Trash2 size={15} /></button>
              </figcaption>
            )}
          </figure>
        ))}
        {editable && media.length < 12 && (
          <button type="button" className={`adm-drop ${over ? 'is-over' : ''}`} onClick={() => fileRef.current?.click()} disabled={!!progress}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
            <Upload size={24} /><strong>{progress || 'Add photos'}</strong><span className="adm-sub">Drag & drop or click · JPG, PNG, WebP · up to 10 MB</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
    </section>
  );
}

// ---- stock & batches (save immediately) --------------------------------------
function Stock({ data, form, set, staff, onChange }) {
  const p = data.product;
  const act = useAction();
  const [receiving, setReceiving] = useState(false);
  const [recall, setRecall] = useState(null);
  const shelf = Number(form.compliance.shelfLifeMonths) || 0;
  const today = new Date().toISOString().slice(0, 10);
  const [b, setB] = useState({ batchNo: '', mfgDate: today, expiryDate: '', qty: '', notes: '' });
  useEffect(() => {      // suggest the expiry date from the shelf life
    if (!shelf || !b.mfgDate) return;
    const dd = new Date(b.mfgDate); dd.setMonth(dd.getMonth() + shelf);
    setB((x) => ({ ...x, expiryDate: x.expiryTouched ? x.expiryDate : dd.toISOString().slice(0, 10) }));
  }, [shelf, b.mfgDate]);
  const receive = async (e) => {
    e.preventDefault();
    const r = await act.run(() => api(`/api/admin/products/${p.id}/batches`, { method: 'POST', body: { batchNo: b.batchNo, mfgDate: b.mfgDate, expiryDate: b.expiryDate, qty: Number(b.qty), notes: b.notes } }),
      (res) => `Batch received: stock is now ${res.onHand}.`);
    if (r) { setB({ batchNo: '', mfgDate: today, expiryDate: '', qty: '', notes: '' }); setReceiving(false); onChange(); }
  };
  const writeOff = async (batch) => {
    const reason = window.prompt(`Write off the remaining ${batch.qty_remaining} unit(s) of batch ${batch.batch_no}? Give a reason (e.g. damaged, recalled):`);
    if (!reason) return;
    const r = await act.run(() => api(`/api/admin/batches/${batch.id}/write-off`, { method: 'POST', body: { reason } }), (res) => `${res.units} unit(s) written off.`);
    if (r) onChange();
  };
  const canStock = can(staff, 'stock.edit');
  const expTone = (n) => (n <= 0 ? 'off' : n <= 30 ? 'bad' : n <= 90 ? 'warn' : 'ok');
  return (
    <>
      <div className="adm-kpis">
        {[['On hand', p.onHand], ['Held for unpaid orders', p.reserved], ['Available to sell', p.available], ['Not in a batch', data.unbatched]].map(([l, v]) => (
          <div className="adm-kpi" key={l}><span className="adm-eyebrow">{l}</span><strong>{v}</strong></div>
        ))}
      </div>
      <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
      <section className="adm-card is-flush">
        <div className="adm-card__head adm-pad" style={{ marginBottom: 0 }}>
          <div><h2 className="adm-h2" style={{ margin: 0 }}>Batches</h2><p className="adm-muted">Orders use the batch that expires first. Expired batches come off sale automatically.</p></div>
          {canStock && <button className="adm-btn" onClick={() => setReceiving((v) => !v)}><PackagePlus size={16} /> Receive a batch</button>}
        </div>
        {receiving && (
          <form className="adm-form adm-pad adm-receive" onSubmit={receive}>
            <div className="adm-grid3" style={{ gap: 12 }}>
              <label>Batch number<input value={b.batchNo} onChange={(e) => setB({ ...b, batchNo: e.target.value.toUpperCase() })} required maxLength={40} autoFocus placeholder="e.g. LB-2611" /></label>
              <label>Units received<input type="number" min="1" value={b.qty} onChange={(e) => setB({ ...b, qty: e.target.value })} required /></label>
              <label>Manufacturing date<input type="date" max={today} value={b.mfgDate} onChange={(e) => setB({ ...b, mfgDate: e.target.value })} required /></label>
              <label>Expiry date{shelf ? <span className="adm-sub">Suggested from {shelf}-month shelf life</span> : null}<input type="date" min={today} value={b.expiryDate} onChange={(e) => setB({ ...b, expiryDate: e.target.value, expiryTouched: true })} required /></label>
              <label style={{ gridColumn: 'span 2' }}>Notes (optional)<input value={b.notes} onChange={(e) => setB({ ...b, notes: e.target.value })} maxLength={300} placeholder="e.g. Invoice 1234 from the plant" /></label>
            </div>
            <div className="adm-actions"><button className="adm-btn" disabled={act.busy}>Add to stock</button><button type="button" className="adm-btn is-ghost" onClick={() => setReceiving(false)}>Cancel</button></div>
          </form>
        )}
        {data.batches.length === 0 ? <p className="adm-muted adm-pad">No batches yet. Receive a batch to track manufacturing and expiry dates.</p> : (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead><tr><th>Batch</th><th>Manufactured</th><th>Expires</th><th className="num">Received</th><th className="num">Shipped</th><th className="num">Left</th><th /></tr></thead>
              <tbody>{data.batches.map((x) => {
                const n = Number(x.days_to_expiry);
                const status = x.written_off_at ? ['Written off', 'off'] : x.qty_remaining === 0 ? ['Sold out', 'off'] : n <= 0 ? ['Expired', 'bad'] : [`${n} days left`, expTone(n)];
                return (
                  <tr key={x.id}>
                    <td><strong>{x.batch_no}</strong>{x.notes && <span className="adm-sub" style={{ whiteSpace: 'pre-line' }}>{x.notes}</span>}</td>
                    <td>{d(x.mfg_date)}</td>
                    <td>{d(x.expiry_date)}<span className="adm-sub"><span className={`adm-badge is-${status[1]}`}>{status[0]}</span></span></td>
                    <td className="num">{x.qty_received}</td><td className="num">{x.shipped}</td><td className="num"><strong>{x.qty_remaining}</strong></td>
                    <td className="adm-rowbtns">
                      {x.shipped > 0 && <button className="adm-btn is-ghost is-sm" onClick={() => setRecall(x.id)}><Users size={14} /> Who received it</button>}
                      {canStock && !x.written_off_at && x.qty_remaining > 0 && <button className="adm-btn is-danger is-ghost is-sm" onClick={() => writeOff(x)}><Ban size={14} /> Write off</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="adm-card adm-form" style={{ maxWidth: 460 }}>
        <h2 className="adm-h2">Low-stock alert</h2>
        <label>Warn me when available stock is at or below<input type="number" min="0" value={form.lowStockAt} onChange={(e) => set('lowStockAt', e.target.value)} disabled={!can(staff, 'products.edit')} /></label>
        <p className="adm-muted">Saved with "Save changes".</p>
      </section>
      <section className="adm-card adm-form" style={{ maxWidth: 460 }}>
        <h2 className="adm-h2">Return policy</h2>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!form.returnable} onChange={(e) => set('returnable', e.target.checked)} disabled={!can(staff, 'products.edit')} /> Customers can return this product</label>
        <label>Return window for this product (days after delivery)<input type="number" min="0" max="90" placeholder="Shop-wide window" value={form.returnDays} onChange={(e) => set('returnDays', e.target.value)} disabled={!can(staff, 'products.edit') || !form.returnable} /></label>
        <p className="adm-muted">Leave the days empty to use the shop-wide window (Settings). Customers see why a product cannot be returned. Saved with "Save changes".</p>
      </section>
      {recall && <Recall id={recall} onClose={() => setRecall(null)} />}
    </>
  );
}

function Recall({ id, onClose }) {
  const { data, error } = useApi(`/api/admin/batches/${id}`);
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Who received this batch">
        <div className="adm-drawer__head"><div style={{ flex: 1 }}><p className="adm-eyebrow">Batch traceability</p><h2>{data ? `${data.batch.product} · ${data.batch.batch_no}` : '…'}</h2></div><button className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="adm-drawer__body">
          <ErrorBox>{error}</ErrorBox>
          {!data ? <Loading /> : (
            <>
              <p className="adm-muted">Made {d(data.batch.mfg_date)} · expires {d(data.batch.expiry_date)} · {data.orders.length} order(s). Use this list to contact customers if a batch is ever recalled.</p>
              <div className="adm-card is-flush">
                <table className="adm-table is-compact">
                  <thead><tr><th>Order</th><th>Customer</th><th className="num">Units</th></tr></thead>
                  <tbody>{data.orders.map((o) => (
                    <tr key={o.order_number}><td><Link to={`/admin/orders/${o.order_number}`}>{o.order_number}</Link><span className="adm-sub">{dt(o.created_at)}</span></td><td><Link to={`/admin/customers/${o.customer_id}`}>{o.name}</Link><span className="adm-sub">+91 {o.phone}</span></td><td className="num">{o.qty}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
