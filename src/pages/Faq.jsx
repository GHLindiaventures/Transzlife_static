import { useState, useMemo } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { Slot } from '../components/ui.jsx';
import { Sep, PageBanner } from '../components/sections/Blocks.jsx';
import { FAQ, PHOTOS } from '../content/site.js';
import { usePageMeta } from '../lib/pageMeta.js';

export default function Faq() {
  usePageMeta('FAQs', 'Answers to common questions about TranzLife products, ingredients, orders, shipping, returns and payments.');
  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return FAQ.items.filter((item) => {
      const matchCat = cat === 'all' || item.cat === cat;
      const matchQuery = !query.trim() || 
        item.q.toLowerCase().includes(query.toLowerCase()) || 
        item.a.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [cat, query]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.items.map((it) => ({
              '@type': 'Question',
              name: it.q,
              acceptedAnswer: { '@type': 'Answer', text: it.a },
            })),
          }).replace(/</g, '\\u003c'),
        }}
      />
      <section className="faq-hero">
        <div className="faq-hero__image">
          <img src="/assets/photos/faq-laptop-banner.png" alt="FAQ Banner" />
          <div className="faq-hero__content-wrapper">
            <div className="faq-hero__content glass-container">
              <h1 className="faq-hero__title">FAQ</h1>
              <h2 className="faq-hero__subtitle">Frequently Asked Questions</h2>
              <p className="faq-hero__text">Get technical and general answers about our products, orders, usage, and support.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="faq">
        <div className="faq__wrap" style={{ maxWidth: '920px', margin: '0 auto', paddingInline: 'var(--pad, 24px)' }}>
          
          {/* Medical Advisory Box */}
          <div className="faq__disclaimer" style={{
            background: 'rgba(36, 80, 42, 0.06)',
            border: '1px solid rgba(36, 80, 42, 0.18)',
            borderRadius: '16px',
            padding: '18px 22px',
            marginBottom: '36px',
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-start',
            color: '#164222',
            boxShadow: '0 4px 12px -8px rgba(15, 47, 29, .12)',
            transition: 'box-shadow .3s ease, transform .3s ease',
            cursor: 'default'
          }}>
            <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--green-700, #1a6b3c)' }} />
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, fontFamily: 'Manrope, sans-serif' }}>
              <strong>Clinical &amp; Regulatory Notice:</strong> TranzLife formulations are classical Ayurvedic and nutritional dietary supplements developed to support everyday balance and well-being. They are not intended to diagnose, treat, cure, or prevent any medical disease. Always consult your personal physician before introducing supplements into ongoing medical care.
            </p>
          </div>

          {/* Search bar & Category filters */}
          <div className="faq__controls" style={{ marginBottom: '32px' }}>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#68826e' }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions (e.g., shipping, cleanroom, diabetes, safety)..."
                style={{
                  width: '100%',
                  height: '48px',
                  paddingLeft: '46px',
                  paddingRight: '16px',
                  borderRadius: '999px',
                  border: '1.5px solid rgba(26, 107, 60, 0.2)',
                  background: '#ffffff',
                  fontSize: '14.5px',
                  fontFamily: 'Manrope, sans-serif',
                  outline: 'none',
                  boxShadow: '0 4px 12px -8px rgba(15, 47, 29, .12)',
                  transition: 'box-shadow .3s ease, transform .3s ease, border-color .3s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {FAQ.categories.map((c) => {
                const active = cat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCat(c.id); setOpen(null); }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '999px',
                      border: active ? '1px solid var(--green-800, #165a32)' : '1px solid rgba(26, 107, 60, 0.15)',
                      background: active ? 'var(--green-800, #165a32)' : 'rgba(255, 255, 255, 0.8)',
                      color: active ? '#ffffff' : '#23442a',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all .2s ease',
                      fontFamily: 'Manrope, sans-serif',
                      boxShadow: active ? '0 6px 16px -8px rgba(15, 47, 29, .25), 0 2px 6px -4px rgba(224, 168, 38, .2)' : '0 4px 12px -8px rgba(15, 47, 29, .12), 0 2px 4px -4px rgba(224, 168, 38, .08)'
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Questions list */}
          <div className="faq__list">
            {filtered.length === 0 ? (
              <p style={{ padding: '36px 0', textAlign: 'center', color: '#5a7863', fontFamily: 'Manrope, sans-serif' }}>
                No questions found matching &ldquo;{query}&rdquo;. Please contact our customer care team directly.
              </p>
            ) : (
              filtered.map((item, i) => {
                const isOpen = open === i;
                return (
                  <div className={`faq__item${isOpen ? ' is-open' : ''}`} key={item.q} style={{ borderBottom: '1px solid var(--hairline, rgba(15, 47, 29, 0.1))' }}>
                    <button
                      className="faq__q"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : i)}
                      style={{
                        width: '100%',
                        minHeight: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        textAlign: 'left',
                        padding: '16px 0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Slot className="slot--q-num" style={{ fontWeight: 800, color: 'var(--green-700, #1a6b3c)' }}>{`${i + 1}.`}</Slot>
                      <Slot className="slot--q" style={{ fontFamily: 'Manrope, system-ui, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--green-950, #08261a)', flex: 1 }}>{item.q}</Slot>
                      <span className="faq__plus" aria-hidden="true" style={{ fontSize: '20px', fontWeight: 300, color: 'var(--green-700, #1a6b3c)' }}></span>
                    </button>
                    {isOpen && (
                      <div className="faq__a" style={{ paddingBottom: '20px', paddingLeft: '28px' }}>
                        <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.68, color: '#27472e', fontFamily: 'Manrope, sans-serif' }}>{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
      <Sep />
    </>
  );
}
