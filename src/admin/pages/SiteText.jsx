// Website text: every page's wording (home, About, FAQ, Contact, footer, blogs, concerns, policies) is stored in the
// database. Pick a document, edit its JSON, save. The site shows the change within about 30 seconds.
import { useEffect, useMemo, useState } from 'react';
import { FileText, Save, RotateCcw } from 'lucide-react';
import { api } from '../../store/lib/api';
import { ErrorBox, Loading, Notice, PageHead, can, dt, useAction, useAdmin, useApi } from '../ui';

export default function SiteText() {
  const { staff } = useAdmin();
  const { data, error } = useApi('/api/admin/site-docs');
  const [key, setKey] = useState('');
  const groups = useMemo(() => {
    const g = {};
    (data?.docs || []).forEach((d) => { (g[d.group] ||= []).push(d); });
    return g;
  }, [data]);
  const edit = can(staff, 'content.site');
  return (
    <>
      <PageHead title="Site text" sub="All wording on the website is stored in the database. Edit a document and save; the site shows it within about 30 seconds." />
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div className="adm-grid2 is-wide-right">
          <div className="adm-card">
            {Object.entries(groups).map(([g, list]) => (
              <section key={g}>
                <h3 className="adm-h3" style={{ marginTop: 0 }}>{g}</h3>
                <ul className="adm-list">
                  {list.map((d) => (
                    <li key={d.key}>
                      <button type="button" className={`adm-btn is-ghost${key === d.key ? ' is-active' : ''}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setKey(d.key)}>
                        <FileText size={16} /> {d.label}
                      </button>
                      <span className="adm-sub">{d.updatedAt ? `${dt(d.updatedAt)} · ${d.updatedBy || ''}` : 'not saved yet'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="adm-card">{key ? <Editor docKey={key} edit={edit && !data.docs.find((x) => x.key === key)?.locked} locked={!!data.docs.find((x) => x.key === key)?.locked} /> : <p className="adm-muted">Choose a document on the left.</p>}</div>
        </div>
      )}
    </>
  );
}

function Editor({ docKey, edit, locked }) {
  const { data, error, reload } = useApi(`/api/admin/site-docs/${encodeURIComponent(docKey)}`);
  const act = useAction();
  const original = useMemo(() => (data ? JSON.stringify(data.data, null, 2) : ''), [data]);
  const [text, setText] = useState('');
  useEffect(() => { setText(original); }, [original]);
  let parsed = null; let bad = '';
  try { parsed = JSON.parse(text); } catch (e) { bad = e.message; }
  const save = async () => {
    const ok = await act.run(() => api(`/api/admin/site-docs/${encodeURIComponent(docKey)}`, { method: 'PUT', body: { data: parsed } }), 'Saved. The website shows this within about 30 seconds.');
    if (ok) reload();
  };
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  return (
    <>
      <h3 className="adm-h3" style={{ marginTop: 0 }}>{data.label}</h3>
      {locked && <p className="adm-muted">Read only: this document also controls the shop, so only the owner or a manager can change it.</p>}
      <ErrorBox>{act.error}</ErrorBox>
      {act.notice && <Notice>{act.notice}</Notice>}
      <textarea className="adm-input" style={{ width: '100%', minHeight: 440, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }} spellCheck={false} value={text} readOnly={!edit} onChange={(e) => setText(e.target.value)} />
      {bad && <p className="adm-error">Not valid JSON yet: {bad}</p>}
      {edit && (
        <div className="adm-actions">
          <button className="adm-btn is-ghost" type="button" onClick={() => setText(original)} disabled={text === original}><RotateCcw size={16} /> Undo changes</button>
          <button className="adm-btn is-gold" type="button" onClick={save} disabled={act.busy || !!bad || text === original}><Save size={16} /> Save</button>
        </div>
      )}
    </>
  );
}
