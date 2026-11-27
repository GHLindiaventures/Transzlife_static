// SEO panel of the article editor: how the article appears in Google and when shared, the SEO fields, and a
// checklist that explains every point of the score. The checks are the same code the server uses
// (server/cms/seo-checks.js), run live in the browser while you write.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, Monitor, Smartphone, X } from 'lucide-react';
import { analyzeSeo, BRAND_SUFFIX, LIMITS, scoreBand } from '../../../server/cms/seo-checks.js';

const STATUS_ICON = { pass: [CheckCircle2, 'is-ok', 'Done'], warn: [AlertTriangle, 'is-warn', 'Could be better'], fail: [XCircle, 'is-bad', 'Needs fixing'] };
const BAND = { good: ['Good', 'is-ok'], ok: ['Needs work', 'is-warn'], poor: ['Poor', 'is-bad'] };

/** Live analysis, recalculated shortly after the article or its SEO fields change. */
export function useSeoAnalysis({ editor, form, ctx, tick }) {
  const [result, setResult] = useState(null);
  const knownPaths = useMemo(() => new Set(ctx?.knownPaths || []), [ctx]);
  useEffect(() => {
    if (!editor) return undefined;
    const t = setTimeout(() => {
      setResult(analyzeSeo({ ...form, content: editor.getJSON() }, { siteOrigin: ctx?.siteOrigin, knownPaths, others: ctx?.others, selfId: form.id }));
    }, 350);
    return () => clearTimeout(t);
  }, [editor, form, ctx, knownPaths, tick]);
  return result;
}

export function ScoreBadge({ score }) {
  if (score == null) return null;
  const [label, tone] = BAND[scoreBand(score)];
  return <span className={`cms-score ${tone}`} title={`SEO checklist: ${score}/100 (${label})`}>{score}</span>;
}

function Counter({ value, range, fallback }) {
  const n = value.length;
  const [lo, hi] = range;
  const tone = !n && !fallback ? 'is-bad' : n === 0 ? '' : n < lo ? 'is-warn' : n > hi ? 'is-bad' : 'is-ok';
  return (
    <span className={`cms-counter ${tone}`}>
      <span className="cms-counter__bar"><span style={{ width: `${Math.min(100, (n / hi) * 100)}%` }} /></span>
      {n ? `${n} / ${hi}` : fallback ? 'Using the default' : 'Empty'}
    </span>
  );
}

function KeywordChips({ value, onChange, disabled }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim().replace(/,$/, '').trim().slice(0, 60);
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase()) && value.length < 15) onChange([...value, t]);
    setText('');
  };
  return (
    <div className="cms-tags">
      {value.map((k) => (
        <span className="adm-chip" key={k}>{k}{!disabled && <button type="button" className="cms-tags__x" aria-label={`Remove ${k}`} onClick={() => onChange(value.filter((v) => v !== k))}><X size={13} /></button>}</span>
      ))}
      {!disabled && <input value={text} placeholder={value.length ? 'Add another' : 'e.g. tulsi tea, pranayama'} maxLength={60} aria-label="Secondary keywords"
        onChange={(e) => (e.target.value.endsWith(',') ? (setText(e.target.value.slice(0, -1)), setTimeout(add)) : setText(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} onBlur={() => text && add()} />}
    </div>
  );
}

function GooglePreview({ title, description, url }) {
  const [device, setDevice] = useState('desktop');
  const crumbs = url.replace(/^https?:\/\//, '').split('/').filter(Boolean);
  return (
    <div className="cms-serp-wrap">
      <div className="cms-preview-head">
        <span className="adm-label">Google preview</span>
        <div className="adm-seg adm-seg-sm" role="radiogroup" aria-label="Search preview size">
          <button type="button" className={device === 'desktop' ? 'is-on' : ''} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={14} /></button>
          <button type="button" className={device === 'mobile' ? 'is-on' : ''} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={14} /></button>
        </div>
      </div>
      <div className={`cms-serp is-${device}`} aria-label="How the article may look in Google">
        <div className="cms-serp__site"><span className="cms-serp__fav" aria-hidden="true">T</span><span><b>TranzLife Biosciences</b><small>{crumbs[0]} › {crumbs.slice(1).join(' › ')}</small></span></div>
        <p className="cms-serp__title">{title}</p>
        <p className="cms-serp__desc">{description || <i>Google will pick some text from the article.</i>}</p>
      </div>
      <p className="adm-field-note">Google may rewrite the title or description it shows. These are the ones we ask for.</p>
    </div>
  );
}

function SharePreview({ title, description, image, host }) {
  return (
    <div className="cms-share" aria-label="How the article may look when shared">
      <div className="cms-share__img">{image ? <img src={image} alt="" /> : <span>No image: add a cover photo</span>}</div>
      <div className="cms-share__body">
        <small>{host}</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}

export default function SeoPanel({ form, setSeo, analysis, disabled, siteHost }) {
  const seo = form.seo;
  const set = (patch) => setSeo({ ...seo, ...patch });
  const defTitle = `${form.title || 'Article title'}${BRAND_SUFFIX}`;
  const title = seo.title || defTitle;
  const description = seo.description || form.excerpt;
  const url = `${siteHost}/blogs/${form.slug}`;
  const shareImage = seo.og.image || form.featuredImage;
  const groups = useMemo(() => {
    const g = new Map();
    for (const c of analysis?.checks || []) { if (!g.has(c.group)) g.set(c.group, []); g.get(c.group).push(c); }
    return [...g];
  }, [analysis]);
  const todo = (analysis?.checks || []).filter((c) => c.status !== 'pass').length;

  return (
    <div className="cms-seo">
      <section className="adm-card">
        <div className="cms-seo__score">
          <ScoreBadge score={analysis?.score} />
          <div>
            <strong>SEO checklist {analysis ? `${analysis.score}/100` : ''}</strong>
            <p className="adm-muted">{analysis ? (todo ? `${todo} thing${todo === 1 ? '' : 's'} to look at below.` : 'Everything on the list is done.') : 'Checking…'}</p>
          </div>
        </div>
        <p className="adm-field-note">A guide to good practice, not a promise of rankings: search engines also weigh things this list cannot see, like how useful the article is and who links to it.</p>
      </section>

      <section className="adm-card adm-form">
        <h2 className="adm-h3">Search result</h2>
        <GooglePreview title={title} description={description} url={url} />
        <label>Focus keyword <small className="adm-muted">(the main phrase people would search for)</small>
          <input value={seo.focusKeyword} maxLength={80} readOnly={disabled} placeholder="e.g. lung detox after smoking" onChange={(e) => set({ focusKeyword: e.target.value })} />
        </label>
        <label>SEO title
          <input value={seo.title} maxLength={120} readOnly={disabled} placeholder={defTitle} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <Counter value={seo.title || defTitle} range={LIMITS.title} fallback />
        <label>Meta description
          <textarea rows={3} value={seo.description} maxLength={320} readOnly={disabled} placeholder={form.excerpt || 'What will the reader learn? Use the focus keyword once.'} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <Counter value={seo.description || form.excerpt || ''} range={LIMITS.description} fallback={!!form.excerpt} />
        <label>Secondary keywords <small className="adm-muted">(related phrases, for your reference and the article’s keywords)</small></label>
        <KeywordChips value={seo.keywords} onChange={(keywords) => set({ keywords })} disabled={disabled} />
      </section>

      <section className="adm-card adm-form">
        <h2 className="adm-h3">Checklist</h2>
        {!analysis ? <p className="adm-muted">Checking…</p> : groups.map(([group, list]) => (
          <div key={group} className="cms-checks-group">
            <p className="adm-eyebrow">{group}</p>
            <ul className="cms-checklist">
              {list.map((c) => {
                const [Icon, tone, word] = STATUS_ICON[c.status];
                return (
                  <li key={c.id} className={tone}>
                    <Icon size={17} aria-label={word} />
                    <div>
                      <strong>{c.label}</strong> <small className="adm-muted">{c.points}/{c.max}</small>
                      <span>{c.message}</span>
                      {c.fix && c.status !== 'pass' && <em>{c.fix}</em>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <details className="cms-howscore">
          <summary>How the score works <ChevronDown size={14} /></summary>
          <p>Each check is worth the points shown. Done = all of them, could be better = half, needs fixing = none. The score is the share of points earned, out of 100. 80 or more is good.</p>
        </details>
      </section>

      <section className="adm-card adm-form">
        <h2 className="adm-h3">Social sharing</h2>
        <p className="adm-field-note">What WhatsApp, Facebook, LinkedIn and X show when someone shares the link. Leave empty to use the SEO title, description and cover photo.</p>
        <SharePreview title={seo.og.title || title} description={seo.og.description || description} image={shareImage} host={siteHost.replace(/^https?:\/\//, '')} />
        <label>Share title<input value={seo.og.title} maxLength={120} readOnly={disabled} placeholder={title} onChange={(e) => set({ og: { ...seo.og, title: e.target.value } })} /></label>
        <label>Share description<textarea rows={2} value={seo.og.description} maxLength={320} readOnly={disabled} placeholder={description} onChange={(e) => set({ og: { ...seo.og, description: e.target.value } })} /></label>
        <label>Share image address<input value={seo.og.image} maxLength={2000} readOnly={disabled} placeholder={form.featuredImage || 'https://…'} onChange={(e) => set({ og: { ...seo.og, image: e.target.value } })} /></label>
        <p className="adm-field-note">Best at 1200 × 630 pixels.</p>
        <details>
          <summary>Different text for X (Twitter)</summary>
          <div className="adm-form" style={{ marginTop: 8 }}>
            <label>X title<input value={seo.twitter.title} maxLength={120} readOnly={disabled} placeholder={seo.og.title || title} onChange={(e) => set({ twitter: { ...seo.twitter, title: e.target.value } })} /></label>
            <label>X description<textarea rows={2} value={seo.twitter.description} maxLength={320} readOnly={disabled} placeholder={seo.og.description || description} onChange={(e) => set({ twitter: { ...seo.twitter, description: e.target.value } })} /></label>
            <label>X image address<input value={seo.twitter.image} maxLength={2000} readOnly={disabled} placeholder={shareImage || 'https://…'} onChange={(e) => set({ twitter: { ...seo.twitter, image: e.target.value } })} /></label>
          </div>
        </details>
      </section>

      <section className="adm-card adm-form">
        <h2 className="adm-h3">Advanced</h2>
        <label className="adm-check"><input type="checkbox" checked={seo.robots.index} disabled={disabled} onChange={(e) => set({ robots: { ...seo.robots, index: e.target.checked } })} /> Show in search results (index)</label>
        {!seo.robots.index && <p className="adm-field-note is-warn">Search engines are asked not to list this article, and it is left out of the sitemap. Visitors with the link can still read it.</p>}
        <label className="adm-check"><input type="checkbox" checked={seo.robots.follow} disabled={disabled} onChange={(e) => set({ robots: { ...seo.robots, follow: e.target.checked } })} /> Let search engines follow the links in it (follow)</label>
        <label>Canonical URL <small className="adm-muted">(only if this article is a copy of a page elsewhere)</small>
          <input value={seo.canonical} maxLength={500} readOnly={disabled} placeholder={url} onChange={(e) => set({ canonical: e.target.value.trim() })} />
        </label>
        {seo.canonical && <p className="adm-field-note is-warn">Search engines will credit {seo.canonical} instead of this page, and this page leaves the sitemap.</p>}
      </section>
    </div>
  );
}
