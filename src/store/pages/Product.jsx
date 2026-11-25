import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, ShieldCheck, Truck, RotateCcw, Leaf, ArrowRight, Lock, Pill, Clock, Package, Lightbulb, Hand, Briefcase, MapPin, Sparkles, FileText, FlaskConical, Sprout, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProduct, PRODUCTS, PACKS } from '../data/products';
import { getGallery } from '../data/gallery';
import { SITE } from '../data/site';
import { getIngredient } from '../data/ingredients';
import { getConcern } from '../data/concerns';
import { ARTICLES } from '../data/articles';
import { useCart, packPrice, packMrp } from '../context/CartContext';
import { QtyStepper } from '../components/CartDrawer';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { Breadcrumbs, Reveal, SectionHead, useTitle } from '../components/Common';
import { listReviews, summarise } from '../data/reviewStore';
import { RatingLine, GalleryActions } from '../components/pdp/ProductActions';
import { IngredientGrid, UseTabs, FaqList, FaqHelp } from '../components/pdp/Sections';
import Reviews from '../components/pdp/Reviews';
import { inr, pctOff } from '../utils/format';
import NotFound from './NotFound';

const ROUTINE_ICON = { Dose: Pill, When: Clock, Format: Package, Tip: Lightbulb, How: Hand, Use: Hand, Apply: Hand, Carry: Briefcase, Where: MapPin };

// Plain pack shots (white background) are blended onto the product tint; photos and the
// generated infographic slides fill the frame as they are.
const isPackShot = (src) => src.startsWith('/img/p/');

function Gallery({ p, children }) {
  const images = getGallery(p);
  const [i, setI] = useState(0);
  const thumbs = useRef(null);
  const touch = useRef(null);
  useEffect(() => setI(0), [p.id]);
  const go = (k) => setI((k + images.length) % images.length);
  // keep the active thumbnail in view inside the scrolling strip
  useEffect(() => {
    const el = thumbs.current?.children[i];
    const box = thumbs.current;
    if (!el || !box) return;
    if (box.scrollHeight > box.clientHeight) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
    else if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [i]);
  // warm the cache so switching slides is instant
  useEffect(() => { images.forEach((src) => { const im = new Image(); im.src = src; }); }, [p.id]);

  const src = images[i];
  const multi = images.length > 1;
  return (
    <div className={`gallery ${multi ? 'gallery--rail' : ''}`}>
      {multi && (
        <div className="gallery__thumbs" ref={thumbs} role="tablist" aria-label="Product images">
          {images.map((s, k) => (
            <button key={s} role="tab" aria-selected={k === i} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} aria-label={`View image ${k + 1} of ${images.length}`}>
              <img src={s} alt="" loading="lazy" className={isPackShot(s) ? 'is-pack' : ''} />
            </button>
          ))}
        </div>
      )}
      <div
        className="gallery__main"
        style={{ background: p.tint }}
        tabIndex={multi ? 0 : undefined}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <img src={src} alt={`${p.name}, image ${i + 1} of ${images.length}`} key={src} className={isPackShot(src) ? 'is-pack' : 'is-full'} />
        {multi && (
          <>
            <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => go(i - 1)} aria-label="Previous image"><ChevronLeft size={22} /></button>
            <button type="button" className="gallery__nav gallery__nav--next" onClick={() => go(i + 1)} aria-label="Next image"><ChevronRight size={22} /></button>
            <span className="gallery__count" aria-hidden="true">{i + 1} / {images.length}</span>
          </>
        )}
        {children}
      </div>
    </div>
  );
}

export default function Product() {
  const { id } = useParams();
  const p = getProduct(id);
  const { add } = useCart();
  const navigate = useNavigate();
  const [pack, setPack] = useState(1);
  const [qty, setQty] = useState(1);
  useTitle(p?.name);
  useEffect(() => { setPack(1); setQty(1); }, [id]);
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    let live = true;
    setReviews([]);
    if (p) listReviews(p.id).then((r) => live && setReviews(r));
    return () => { live = false; };
  }, [p?.id]);
  const summary = useMemo(() => summarise(reviews), [reviews]);

  if (!p) return <NotFound />;

  const unit = packPrice(p, pack);
  const mrp = packMrp(p, pack);
  const off = pctOff(unit, mrp);
  const concerns = p.concerns.map(getConcern).filter(Boolean);
  const ings = p.ingredients.map(getIngredient).filter(Boolean);
  // every other product, ones sharing a concern first
  const related = PRODUCTS.filter((x) => x.id !== p.id).sort((a, b) => (b.concerns.some((c) => p.concerns.includes(c)) ? 1 : 0) - (a.concerns.some((c) => p.concerns.includes(c)) ? 1 : 0));
  // Journal articles for this product's concerns, in the order the concerns are listed
  const reads = [...new Set(p.concerns.flatMap((c) => ARTICLES.filter((a) => a.concern === c)))].slice(0, 3);
  const facts = [
    ings.length > 0 && { icon: Sprout, value: ings.length, label: 'Key ingredients' },
    { icon: FlaskConical, value: p.size, label: 'Pack size' },
    concerns[0] && { icon: Leaf, value: concerns[0].short, label: 'Made for' },
    { icon: MapPin, value: 'Made in India', label: 'Chennai' },
  ].filter(Boolean);

  return (
    <div className="pdpx" style={{ '--p-accent': p.accent, '--tint': p.tint }}>
      <section className="container pdp">
        <Breadcrumbs items={[['Shop', '/shop'], [p.short]]} />
        <div className="pdp__grid">
          <Gallery p={p}><GalleryActions product={p} /></Gallery>
          <div className="pdp__info">
            {p.badge && <span className="tag">{p.badge}</span>}
            <h1>{p.name}</h1>
            <RatingLine summary={summary} />
            <p className="pdp__tagline">{p.tagline}</p>
            <div className="pdp__chips">
              {concerns.map((c) => (
                <Link key={c.id} to={`/concerns/${c.id}`} className="chip" style={{ '--c': c.color }}><Icon name={c.icon} size={14} /> {c.title}</Link>
              ))}
            </div>

            <div className="pdp__price">
              <strong>{inr(unit)}</strong>
              {mrp > unit && <><s>MRP {inr(mrp)}</s><span className="save">Save {inr(mrp - unit)} ({off}% off)</span></>}
            </div>
            <p className="pdp__tax">Inclusive of all taxes · {p.size} {p.format.toLowerCase()}</p>

            <ul className="pdp__highlights">
              {p.highlights.map((h) => <li key={h}><Check size={16} /> {h}</li>)}
            </ul>

            <fieldset className="packs">
              <legend>Choose your pack</legend>
              {PACKS.map((pk) => {
                const price = packPrice(p, pk.qty);
                return (
                  <label key={pk.qty} className={`pack ${pack === pk.qty ? 'is-active' : ''}`}>
                    <input type="radio" name="pack" value={pk.qty} checked={pack === pk.qty} onChange={() => setPack(pk.qty)} />
                    {pk.tag && <span className="pack__tag">{pk.tag}</span>}
                    <strong>{pk.label}</strong>
                    <span>{inr(price)}</span>
                    <small>{inr(Math.round(price / pk.qty))} each</small>
                  </label>
                );
              })}
            </fieldset>

            <div className="pdp__buy">
              <QtyStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} />
              <button className="btn btn--lg btn--grow btn--ghost" onClick={() => add(p.id, qty, pack)}>Add to cart</button>
              <button className="btn btn--lg btn--grow" onClick={() => { add(p.id, qty, pack, { openDrawer: false }); navigate('/checkout'); }}>Buy now</button>
            </div>

            <div className="pdp__trust">
              <span><Truck size={18} /> Free shipping above ₹{SITE.freeShippingAbove}</span>
              <span><Lock size={18} /> Secure checkout</span>
              <span><RotateCcw size={18} /> Easy returns on damaged items</span>
              <span><Leaf size={18} /> Plant-based</span>
            </div>

            <div className="routine2">
              <p className="routine2__title">Your daily routine</p>
              <ul>
                {p.routine.map((r) => {
                  const I = ROUTINE_ICON[r.label] || Sparkles;
                  return (
                    <li key={r.label}>
                      <span className="routine2__icon" aria-hidden="true"><I size={18} /></span>
                      <span className="routine2__text"><small>{r.label}</small><strong>{r.value}</strong></span>
                    </li>
                  );
                })}
              </ul>
              {p.brochure && (
                <a href={p.brochure} className="routine2__pdf" target="_blank" rel="noreferrer">
                  <FileText size={18} aria-hidden="true" />
                  <span><strong>Product brochure</strong><small>PDF · opens in a new tab</small></span>
                  <Download size={18} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section pdp-about">
        <div className="container pdp-about__grid">
          <Reveal>
            <p className="eyebrow">About the product</p>
            <h2>{p.summary}</h2>
            {p.description.map((d) => <p key={d.slice(0, 20)} className="lead">{d}</p>)}
          </Reveal>
          <Reveal className="benefit-card" delay={100}>
            <h3>Why you will love it</h3>
            <ul>
              {p.benefits.map((b) => <li key={b}><span><Check size={16} /></span>{b}</li>)}
            </ul>
          </Reveal>
        </div>
        <div className="container">
          <ul className="pdp-facts">
            {facts.map((f) => (
              <li key={f.label}>
                <span className="pdp-facts__icon" aria-hidden="true"><f.icon size={20} /></span>
                <span><strong>{f.value}</strong><small>{f.label}</small></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--sand">
        <div className="container pdp-ings">
          <div className="pdp-ings__head">
            <p className="eyebrow">Key ingredients</p>
            <h2>What’s inside</h2>
            <p className="shead__text">{ings.length} carefully chosen ingredients. Tap one to learn more.</p>
            <Link to="/ingredients" className="link-arrow">Ingredient library <ArrowRight size={16} /></Link>
          </div>
          <div>
            <IngredientGrid ings={ings} />
            {p.id === 'breathefree-inhaler' && <p className="note">Aroma profile shown above. The full essential-oil declaration is printed on the pack.</p>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <UseTabs p={p} />
        </div>
      </section>

      <section className="section">
        <div className="container faq-home">
          <div>
            <SectionHead eyebrow="FAQs" title="Questions about this product" />
            <FaqHelp className="faqhelp--side" />
          </div>
          <Reveal><FaqList items={p.faqs} /><FaqHelp className="faqhelp--below" /></Reveal>
        </div>
      </section>

      <Reviews product={p} reviews={reviews} setReviews={setReviews} summary={summary} />

      <section className="section section--sand">
        <div className="container">
          <SectionHead eyebrow="You may also like" title="Complete your routine" />
          <div className="grid-products grid-products--5 m-scroll">
            {related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </div>
      </section>

      {reads.length > 0 && (
        <section className="section section--tight reads">
          <div className="container">
            <SectionHead
              eyebrow="Wellness journal"
              title="Read before you start"
              text="Simple guides on how your body works and the everyday habits that go with this product."
              action={<Link to="/journal" className="link-arrow">All articles <ArrowRight size={16} /></Link>}
            />
            <div className="reads2 m-scroll">
              {reads.map((a) => (
                <Link key={a.id} to={`/journal/${a.id}`} className="read2">
                  <span className="read2__img"><img src={a.image} alt="" loading="lazy" /></span>
                  <span className="read2__body">
                    <span className="acard__meta">{a.category} · {a.readTime}</span>
                    <strong>{a.title}</strong>
                    <span className="read2__excerpt">{a.excerpt}</span>
                    <span className="link-arrow">Read article <ArrowRight size={14} /></span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container disclaimer">
        <ShieldCheck size={20} />
        <p>This product is not intended to diagnose, treat, cure or prevent any disease. Read the label before use. If you are pregnant, breastfeeding, on medication or have a medical condition, consult your healthcare professional.</p>
      </section>

      <div className="sticky-buy">
        <img src={p.images[0]} alt="" />
        <span><strong>{p.short}</strong><small>{inr(unit)}</small></span>
        <button className="btn" onClick={() => add(p.id, qty, pack)}>Add to cart</button>
      </div>
    </div>
  );
}
