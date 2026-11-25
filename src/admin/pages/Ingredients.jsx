// Ingredient library: the botanicals and nutrients shown on product pages and the website's
// ingredient library. Edit names, Latin names, traditional-use notes and photos.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Upload, RotateCcw, Leaf, Info } from 'lucide-react';
import { api } from '../../store/lib/api';
import { getIngredientImg } from '../../store/data/ingredients';
import { Empty, ErrorBox, Loading, Notice, PageHead, can, useAction, useAdmin, useApi } from '../ui';

const TYPE = { herb: 'Ayurvedic herb', oil: 'Essential oil', nutrient: 'Micronutrient', homeo: 'Homeopathic preparation' };
const photoOf = (g) => g.photo_url || getIngredientImg(g.id);

export default function Ingredients() {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/ingredients');
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [open, setOpen] = useState(null);       // ingredient id, or 'new'
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const list = data.ingredients.filter((g) => (type === 'all' || g.type === type) && (!q || `${g.name} ${g.alt} ${g.latin}`.toLowerCase().includes(q.toLowerCase())));
  const counts = Object.fromEntries(['all', ...data.types].map((t) => [t, t === 'all' ? data.ingredients.length : data.ingredients.filter((g) => g.type === t).length]));
  return (
    <>
      <PageHead title="Ingredients" sub="The ingredient library shown on product pages and the website. Notes describe traditional use, not product claims.">
        {can(staff, 'products.edit') && <button className="adm-btn" onClick={() => setOpen('new')}><Plus size={16} /> Add ingredient</button>}
      </PageHead>
      <div className="adm-filters"><form onSubmit={(e) => e.preventDefault()}><Search size={16} /><input type="search" placeholder="Name, other name or Latin name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ingredients" /></form></div>
      <div className="adm-chips" role="group" aria-label="Type">
        {['all', ...data.types].map((t) => <button key={t} className={`adm-chip ${type === t ? 'is-on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>{t === 'all' ? 'All' : TYPE[t]} <b>{counts[t]}</b></button>)}
      </div>
      {list.length === 0 ? <section className="adm-card"><Empty icon={Leaf} title="No ingredients match" /></section> : (
        <div className="adm-igrid">
          {list.map((g) => (
            <button key={g.id} className={`adm-icard ${g.active ? '' : 'is-hidden'}`} onClick={() => setOpen(g.id)}>
              <span className="adm-icard__img"><img src={photoOf(g)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /></span>
              <strong>{g.name}</strong>
              <span className="adm-sub"><em>{g.latin || '—'}</em></span>
              <span className="adm-icard__foot"><span className="adm-badge is-muted">{TYPE[g.type]}</span>{!g.active && <span className="adm-badge is-off">Hidden</span>}</span>
              <span className="adm-sub">{g.used_in.length ? `In ${g.used_in.length} product${g.used_in.length === 1 ? '' : 's'}` : 'Not used yet'}</span>
            </button>
          ))}
        </div>
      )}
      {open && <IngredientDrawer id={open} item={data.ingredients.find((g) => g.id === open)} editable={can(staff, 'products.edit')} onClose={() => setOpen(null)} onSaved={(id) => { reload(); if (id) setOpen(id); }} />}
    </>
  );
}

function IngredientDrawer({ id, item, editable, onClose, onSaved }) {
  const isNew = id === 'new';
  const act = useAction();
  const fileRef = useRef(null);
  const [f, setF] = useState(() => ({ name: item?.name || '', alt: item?.alt || '', latin: item?.latin || '', type: item?.type || 'herb', part: item?.part || '', note: item?.note || '', active: item?.active ?? true }));
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const r = await act.run(() => (isNew ? api('/api/admin/ingredients', { method: 'POST', body: f }) : api(`/api/admin/ingredients/${id}`, { method: 'PATCH', body: f })), 'Saved. The website shows it right away.');
    if (r) onSaved(isNew ? r.id : null);
  };
  const upload = async (file) => {
    if (!file) return;
    act.setError(''); act.setNotice('');
    const res = await fetch(`/api/admin/ingredients/${id}/photo`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) act.setError(body.error || 'Upload failed.'); else { act.setNotice('Photo updated.'); onSaved(); }
  };
  const resetPhoto = async () => { if (await act.run(() => api(`/api/admin/ingredients/${id}/photo`, { method: 'DELETE', body: {} }), 'Back to the built-in photo.')) onSaved(); };
  const remove = async () => { if (window.confirm(`Delete ${item.name}?`) && await act.run(() => api(`/api/admin/ingredients/${id}`, { method: 'DELETE', body: {} }))) { onSaved(); onClose(); } };

  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label={isNew ? 'Add ingredient' : `Edit ${item?.name}`}>
        <div className="adm-drawer__head"><div style={{ flex: 1 }}><p className="adm-eyebrow">Ingredient</p><h2>{isNew ? 'Add an ingredient' : item?.name}</h2></div><button className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <form className="adm-drawer__body" onSubmit={save}>
          <ErrorBox>{act.error}</ErrorBox><Notice>{act.notice}</Notice>
          {!isNew && (
            <div className="adm-card adm-iphoto">
              <img src={photoOf(item)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              <div>
                <p className="adm-muted">{item.photo_url ? 'Uploaded photo' : 'Built-in photo'}. A cut-out on a plain or transparent background looks best.</p>
                {editable && (
                  <div className="adm-actions" style={{ marginTop: 8 }}>
                    <button type="button" className="adm-btn is-ghost is-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload photo</button>
                    {item.photo_url && <button type="button" className="adm-btn is-ghost is-sm" onClick={resetPhoto}><RotateCcw size={14} /> Use built-in</button>}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
              </div>
            </div>
          )}
          <fieldset disabled={!editable} className="adm-card adm-form" style={{ margin: 0 }}>
            <div className="adm-pair">
              <label>Name<input value={f.name} onChange={set('name')} required minLength={2} maxLength={80} autoFocus={isNew} placeholder="e.g. Tulsi" /></label>
              <label>Other name<input value={f.alt} onChange={set('alt')} maxLength={80} placeholder="e.g. Holy Basil" /></label>
            </div>
            <label>Latin name<input value={f.latin} onChange={set('latin')} maxLength={120} placeholder="e.g. Ocimum sanctum" /></label>
            <div className="adm-pair">
              <label>Type<select value={f.type} onChange={set('type')}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Part used<input value={f.part} onChange={set('part')} maxLength={60} placeholder="e.g. Leaf, Root" /></label>
            </div>
            <label>Traditional use<span className="adm-sub">{f.note.length}/800 · how it has traditionally been used; not a claim about a product</span><textarea rows={5} maxLength={800} value={f.note} onChange={set('note')} /></label>
            <label className="adm-check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Show on the website</label>
            <p className="adm-muted"><Info size={13} style={{ verticalAlign: '-2px' }} /> Say "traditionally used for", not "cures" or "treats".</p>
          </fieldset>
          {!isNew && item.used_in.length > 0 && (
            <div className="adm-card"><h3 className="adm-h3" style={{ marginTop: 0 }}>Used in</h3><ul className="adm-list">{item.used_in.map((p) => <li key={p.id}><Link to={`/admin/products/${p.id}`}>{p.name}</Link></li>)}</ul></div>
          )}
          {editable && (
            <div className="adm-actions">
              <button className="adm-btn" disabled={act.busy}>{isNew ? 'Add ingredient' : 'Save changes'}</button>
              {!isNew && item.used_in.length === 0 && <button type="button" className="adm-btn is-danger is-ghost" onClick={remove}>Delete</button>}
            </div>
          )}
        </form>
      </aside>
    </>
  );
}
