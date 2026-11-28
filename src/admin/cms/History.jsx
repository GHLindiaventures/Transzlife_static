// Version history of an article: every save, publish, schedule and restore keeps a full copy. Pick one to see
// what changed (against what is in the editor now, or against the version before it) and restore it if needed.
// Restoring keeps the current text as a version first, so it can always be undone; the URL is not changed.
import { useEffect, useMemo, useState } from 'react';
import { History as HistoryIcon, RotateCcw, X } from 'lucide-react';
import { api } from '../../store/lib/api';
import { docLines, diffLines } from '../../../server/cms/render.js';
import { fmtIST } from './time';

export const REASON = {
  import: 'Imported from the old site', create: 'Created', save: 'Saved', autosave: 'Autosaved', publish: 'Published',
  unpublish: 'Unpublished', schedule: 'Scheduled', archive: 'Archived', restore: 'Restored an earlier version',
};

/** The fields worth comparing, as label -> text. */
function fields(s, names) {
  const seo = s.seo || {};
  return [
    ['Title', s.title || ''], ['Summary', s.excerpt || ''],
    ['Cover photo', s.featuredImage || ''], ['Cover alt text', s.featuredImageAlt || ''],
    ['Category', names.categories.get(s.categoryId) || (s.categoryId ? '(deleted category)' : '')],
    ['Byline', names.authors.get(s.authorId) || (s.authorId ? '(deleted byline)' : '')],
    ['Tags', (s.tags || []).join(', ')], ['Featured', s.featured ? 'Yes' : 'No'], ['Disclaimer', s.disclaimer || ''],
    ['SEO title', seo.title || ''], ['Meta description', seo.description || ''], ['Focus keyword', seo.focusKeyword || ''],
  ];
}

export default function HistoryDialog({ postId, current, choices, canRestore, onRestore, onClose }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null);          // revision id
  const [mode, setMode] = useState('current');     // compare with: current | previous
  const [cache, setCache] = useState({});          // id -> snapshot
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => ({
    categories: new Map(choices.categories.map((c) => [c.id, c.name])),
    authors: new Map(choices.authors.map((a) => [a.id, a.name])),
  }), [choices]);

  useEffect(() => {
    api(`/api/admin/cms/posts/${postId}/revisions`).then((r) => { setList(r.revisions); setPick(r.revisions[0]?.id ?? null); }).catch((e) => setError(e.message));
  }, [postId]);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const idx = list ? list.findIndex((r) => r.id === pick) : -1;
  const prevId = idx >= 0 ? list[idx + 1]?.id : null;
  const needed = [pick, mode === 'previous' ? prevId : null].filter(Boolean);
  useEffect(() => {
    for (const id of needed) {
      if (cache[id]) continue;
      api(`/api/admin/cms/revisions/${id}`).then((r) => setCache((c) => ({ ...c, [id]: r.revision.snapshot }))).catch((e) => setError(e.message));
    }
  }, [needed.join(','), cache]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = pick ? cache[pick] : null;
  const base = mode === 'current' ? current() : prevId ? cache[prevId] : { content: { type: 'doc', content: [] } };
  const ready = chosen && base;
  // "before" = the other version, "after" = the picked one: green lines are what restoring would bring back
  const fieldDiff = ready ? fields(chosen, names).map(([label, v], i) => [label, fields(base, names)[i][1], v]).filter(([, a, b]) => a !== b) : [];
  const lines = ready ? diffLines(docLines(base.content), docLines(chosen.content)) : [];
  const changed = lines.filter((l) => l.type !== 'same').length;

  const restore = async () => {
    const r = list.find((x) => x.id === pick);
    if (!window.confirm(`Restore the version from ${fmtIST(r.at)}?\n\nWhat is in the editor now is kept in the history first, so you can switch back. The URL does not change.`)) return;
    setBusy(true); setError('');
    try { await onRestore(pick); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <div className="cms-preview cms-history" role="dialog" aria-label="Version history">
        <div className="cms-preview__bar">
          <strong><HistoryIcon size={16} /> Version history</strong>
          <span className="adm-muted">Every save, publish and schedule keeps a copy. Autosaves keep one every 10 minutes.</span>
          <button type="button" className="adm-icon" onClick={onClose} aria-label="Close version history"><X size={20} /></button>
        </div>
        {error && <p className="adm-error adm-pad" role="alert">{error}</p>}
        <div className="cms-history__body">
          <ol className="cms-history__list" aria-label="Versions, newest first">
            {!list ? <li className="adm-muted adm-pad">Loading…</li> : list.map((r, i) => (
              <li key={r.id}>
                <button type="button" className={pick === r.id ? 'is-on' : ''} aria-current={pick === r.id} onClick={() => setPick(r.id)}>
                  <strong>{REASON[r.reason] || r.reason}{i === 0 && <span className="adm-badge is-info">Latest</span>}</strong>
                  <span>{fmtIST(r.at)}</span>
                  <small>{r.by === 'scheduler' ? 'Automatic (scheduled time)' : r.by || ''}</small>
                  {r.title && <small className="cms-history__title">{r.title}</small>}
                </button>
              </li>
            ))}
          </ol>
          <section className="cms-history__view">
            <div className="cms-history__head">
              <div className="adm-seg" role="radiogroup" aria-label="Compare with">
                <button type="button" className={mode === 'current' ? 'is-on' : ''} aria-pressed={mode === 'current'} onClick={() => setMode('current')}>Compare with the editor now</button>
                <button type="button" className={mode === 'previous' ? 'is-on' : ''} aria-pressed={mode === 'previous'} onClick={() => setMode('previous')}>What this version changed</button>
              </div>
              {canRestore && pick && idx > 0 && (
                <button type="button" className="adm-btn is-gold" disabled={busy || !ready} onClick={restore}><RotateCcw size={16} /> {busy ? 'Restoring…' : 'Restore this version'}</button>
              )}
            </div>
            <p className="cms-note">
              {mode === 'current'
                ? <><span className="cms-diff-key is-added">Green</span> is in this version but not in the editor now; <span className="cms-diff-key is-removed">red</span> is in the editor now but not in this version.</>
                : <><span className="cms-diff-key is-added">Green</span> was added and <span className="cms-diff-key is-removed">red</span> was removed in this version.</>}
            </p>
            {!ready ? <p className="adm-muted">Loading…</p> : (
              <>
                <h3 className="adm-h3">Details</h3>
                {fieldDiff.length === 0 ? <p className="adm-muted">No differences in the title, summary, photo, category, tags or SEO fields.</p> : (
                  <table className="adm-table cms-fielddiff">
                    <thead><tr><th>Field</th><th>{mode === 'current' ? 'Editor now' : 'Before'}</th><th>{mode === 'current' ? 'This version' : 'After'}</th></tr></thead>
                    <tbody>{fieldDiff.map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td className="is-removed">{a || <i>empty</i>}</td><td className="is-added">{b || <i>empty</i>}</td></tr>)}</tbody>
                  </table>
                )}
                <h3 className="adm-h3">Text {changed ? <small className="adm-muted">({changed} line{changed === 1 ? '' : 's'} differ)</small> : null}</h3>
                {changed === 0 ? <p className="adm-muted">The article text is the same.</p> : (
                  <ol className="cms-diff">
                    {lines.map((l, i) => (l.type === 'same'
                      ? <li key={i} className="is-same">{l.text}</li>
                      : <li key={i} className={`is-${l.type}`}><span className="adm-sr">{l.type === 'added' ? 'Added: ' : 'Removed: '}</span>{l.text}</li>))}
                  </ol>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
