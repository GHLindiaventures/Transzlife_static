import { useState } from 'react';
import { ErrorBox, Loading, Notice, PageHead, can, dt, rs, toPaise, useAction, useAdmin, useApi } from '../ui';
import { api } from '../../store/lib/api';

/** Prices, GST details and stock. Changes apply to checkout immediately and are audited. */
export default function Products() {
  const { staff } = useAdmin();
  const { data, error, reload } = useApi('/api/admin/products');
  const [open, setOpen] = useState(null);
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHead title="Products & stock" sub="Price changes apply to new checkouts immediately. Available = on hand minus units held for unpaid orders." />
      <section className="adm-card is-flush">
        <table className="adm-table">
          <thead><tr><th>Product</th><th className="num">Price</th><th className="num">MRP</th><th className="num">On hand</th><th className="num">Held</th><th className="num">Available</th><th className="num">Sold (30d)</th><th>Status</th><th /></tr></thead>
          <tbody>{data.products.map((p) => (
            <ProductRow key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} staff={staff} onSaved={reload} />
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

function ProductRow({ p, open, onToggle, staff, onSaved }) {
  const low = p.available <= p.low_stock_at;
  return (
    <>
      <tr className={open ? 'is-open' : ''}>
        <td><strong>{p.name}</strong><small className="adm-sub">{p.size} · {p.id}</small></td>
        <td className="num">{rs(p.price)}</td>
        <td className="num">{rs(p.mrp)}</td>
        <td className="num">{p.on_hand}</td>
        <td className="num">{p.reserved}</td>
        <td className={`num ${p.available <= 0 ? 'is-bad' : low ? 'is-warn' : ''}`}>{p.available}</td>
        <td className="num">{p.sold_30d}</td>
        <td>{p.active ? <span className="adm-badge is-ok">On sale</span> : <span className="adm-badge is-off">Hidden</span>}</td>
        <td><button className="adm-btn is-ghost is-sm" onClick={onToggle}>{open ? 'Close' : 'Manage'}</button></td>
      </tr>
      {open && <tr className="adm-expand"><td colSpan={9}><ProductEditor p={p} staff={staff} onSaved={onSaved} /></td></tr>}
    </>
  );
}

function ProductEditor({ p, staff, onSaved }) {
  const act = useAction();
  const [f, setF] = useState({ price: p.price / 100, mrp: p.mrp / 100, gstRate: p.gst_rate ?? '', hsnCode: p.hsn_code ?? '', lowStockAt: p.low_stock_at, active: p.active });
  const [stock, setStock] = useState({ mode: 'add', units: '', note: '' });
  const moves = useApi(`/api/admin/products/${p.id}/stock`);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const editable = can(staff, 'products.edit'), stockable = can(staff, 'stock.edit');

  const save = async (e) => {
    e.preventDefault();
    const body = { price: toPaise(f.price), mrp: toPaise(f.mrp), active: f.active, lowStockAt: Number(f.lowStockAt),
      gstRate: f.gstRate === '' ? null : Number(f.gstRate), hsnCode: f.hsnCode || null };
    if (await act.run(() => api(`/api/admin/products/${p.id}`, { method: 'PATCH', body }), 'Saved.')) onSaved();
  };
  const adjust = async (e) => {
    e.preventDefault();
    const units = Number(stock.units);
    if (await act.run(() => api(`/api/admin/products/${p.id}/stock`, { method: 'POST', body: { mode: stock.mode, units, note: stock.note } }), (r) => `Stock is now ${r.onHand}.`)) {
      setStock({ mode: 'add', units: '', note: '' }); onSaved(); moves.reload();
    }
  };

  return (
    <div className="adm-editor">
      <ErrorBox>{act.error}</ErrorBox>
      <Notice>{act.notice}</Notice>
      <div className="adm-grid3">
        <form className="adm-form" onSubmit={save}>
          <h3 className="adm-h3">Price & details</h3>
          <div className="adm-pair">
            <label>Price (₹)<input type="number" min="1" step="1" value={f.price} onChange={set('price')} disabled={!editable} required /></label>
            <label>MRP (₹)<input type="number" min="1" step="1" value={f.mrp} onChange={set('mrp')} disabled={!editable} required /></label>
          </div>
          <div className="adm-pair">
            <label>GST %<input type="number" min="0" max="28" step="0.01" value={f.gstRate} onChange={set('gstRate')} disabled={!editable} placeholder="e.g. 12" /></label>
            <label>HSN code<input inputMode="numeric" maxLength={8} value={f.hsnCode} onChange={set('hsnCode')} disabled={!editable} placeholder="e.g. 30049011" /></label>
          </div>
          <label>Low-stock alert when available is at or below<input type="number" min="0" value={f.lowStockAt} onChange={set('lowStockAt')} disabled={!editable} /></label>
          <label className="adm-check"><input type="checkbox" checked={f.active} onChange={set('active')} disabled={!editable} /> On sale (unticked: customers can't order it)</label>
          {editable && <button className="adm-btn" disabled={act.busy}>Save changes</button>}
        </form>

        <form className="adm-form" onSubmit={adjust}>
          <h3 className="adm-h3">Stock</h3>
          <p className="adm-muted">On hand {p.on_hand} · held {p.reserved} · available {p.available}</p>
          <div className="adm-seg">
            <label className={stock.mode === 'add' ? 'is-on' : ''}><input type="radio" checked={stock.mode === 'add'} onChange={() => setStock((s) => ({ ...s, mode: 'add' }))} disabled={!stockable} /> Add / remove</label>
            <label className={stock.mode === 'set' ? 'is-on' : ''}><input type="radio" checked={stock.mode === 'set'} onChange={() => setStock((s) => ({ ...s, mode: 'set' }))} disabled={!stockable} /> Set counted total</label>
          </div>
          <label>{stock.mode === 'add' ? 'Units (negative to write off, e.g. -2)' : 'Counted units on hand'}
            <input type="number" step="1" min={stock.mode === 'set' ? 0 : undefined} value={stock.units} onChange={(e) => setStock((s) => ({ ...s, units: e.target.value }))} disabled={!stockable} required />
          </label>
          <label>Note<input maxLength={300} value={stock.note} onChange={(e) => setStock((s) => ({ ...s, note: e.target.value }))} placeholder="e.g. Batch 42 received / 2 damaged" disabled={!stockable} /></label>
          {stockable && <button className="adm-btn" disabled={act.busy || stock.units === ''}>Update stock</button>}
        </form>

        <div>
          <h3 className="adm-h3">Stock history</h3>
          {!moves.data ? <Loading /> : (
            <ul className="adm-list is-scroll">{moves.data.movements.map((m, i) => (
              <li key={i}><strong className={m.change > 0 ? 'is-ok' : 'is-bad'}>{m.change > 0 ? '+' : ''}{m.change}</strong> {m.reason}<small className="adm-sub">{m.ref || ''} · {dt(m.created_at)}</small></li>
            ))}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
