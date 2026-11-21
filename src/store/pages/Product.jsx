import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, ShieldCheck, Truck, RotateCcw, Leaf, TriangleAlert, Users, ArrowRight, Lock, Clock } from 'lucide-react';
import { getProduct, PRODUCTS, PACKS } from '../data/products';
import { getIngredient, INGREDIENT_TYPES } from '../data/ingredients';
import { getConcern } from '../data/concerns';
import { ARTICLES } from '../data/articles';
import { useCart, packPrice, packMrp } from '../context/CartContext';
import { QtyStepper } from '../components/CartDrawer';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { Accordion, Breadcrumbs, Reveal, SectionHead, useTitle } from '../components/Common';
import { inr, pctOff } from '../utils/format';
import NotFound from './NotFound';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.jsx';

function Gallery({ p }) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [p.id]);
  return (
    <div className="gallery">
      <div className="gallery__main" style={{ background: p.tint }}>
        <img src={p.images[i]} alt={p.name} key={p.images[i]} />
      </div>
      {p.images.length > 1 && (
        <div className="gallery__thumbs">
          {p.images.map((src, k) => (
            <button key={src} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} aria-label={`View image ${k + 1}`}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
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

  if (!p) return <NotFound />;

  const unit = packPrice(p, pack);
  const mrp = packMrp(p, pack);
  const off = pctOff(unit, mrp);
  const concerns = p.concerns.map(getConcern).filter(Boolean);
  const ings = p.ingredients.map(getIngredient).filter(Boolean);
  const related = PRODUCTS.filter((x) => x.id !== p.id).sort((a, b) => (b.concerns.some((c) => p.concerns.includes(c)) ? 1 : 0) - (a.concerns.some((c) => p.concerns.includes(c)) ? 1 : 0)).slice(0, 4);
  // Journal articles for this product's concerns, in the order the concerns are listed
  const reads = p.concerns.flatMap((c) => ARTICLES.filter((a) => a.concern === c)).slice(0, 3);

  return (
    <div style={{ '--p-accent': p.accent, '--tint': p.tint }}>
      <section className="container pdp">
        <Breadcrumbs items={[['Shop', '/shop'], [p.short]]} />
        <div className="pdp__grid">
          <Gallery p={p} />
          <div className="pdp__info">
            {p.badge && <span className="tag">{p.badge}</span>}
            <h1>{p.name}</h1>
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
              <span><Truck size={18} /> Free shipping above ₹499</span>
              <span><Lock size={18} /> Secure checkout</span>
              <span><RotateCcw size={18} /> Easy returns on damaged items</span>
              <span><Leaf size={18} /> Plant-based</span>
            </div>

            <div className="routine">
              {p.routine.map((r) => (
                <div key={r.label}><small>{r.label}</small><strong>{r.value}</strong></div>
              ))}
            </div>

            {p.brochure && (
              <a href={p.brochure} className="link-arrow" target="_blank" rel="noreferrer"><Download size={16} /> Download product brochure (PDF)</a>
            )}
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
      </section>

      <section className="section section--sand">
        <div className="container">
          <SectionHead eyebrow="Key ingredients" title="What’s inside" text={`${ings.length} carefully chosen ingredients. Tap any ingredient to learn more in our ingredient library.`} action={<Link to="/ingredients" className="link-arrow">Ingredient library <ArrowRight size={16} /></Link>} />
          <div className="ings">
            {ings.map((ing, k) => (
              <Reveal key={ing.id} delay={k * 40}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to={`/ingredients#${ing.id}`} className="ing">
                      <span className="ing__dot" style={{ background: INGREDIENT_TYPES[ing.type].color }}>{ing.name.charAt(0)}</span>
                      <span>
                        <strong>{ing.name}</strong>
                        <small>{ing.alt}</small>
                        <em>{INGREDIENT_TYPES[ing.type].label}</em>
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className="tip">{ing.note}</TooltipContent>
                </Tooltip>
              </Reveal>
            ))}
          </div>
          {p.id === 'breathefree-inhaler' && <p className="note">Aroma profile shown above. The full essential-oil declaration is printed on the pack.</p>}
        </div>
      </section>

      <section className="section">
        <div className="container pdp-use">
          <Reveal className="use-card">
            <Clock size={26} strokeWidth={1.5} />
            <h3>How to use</h3>
            <ol>{p.howToUse.map((s) => <li key={s}>{s}</li>)}</ol>
          </Reveal>
          <Reveal className="use-card" delay={80}>
            <Users size={26} strokeWidth={1.5} />
            <h3>Who is it for?</h3>
            <ul>{p.whoFor.map((s) => <li key={s}>{s}</li>)}</ul>
          </Reveal>
          <Reveal className="use-card use-card--warn" delay={160}>
            <TriangleAlert size={26} strokeWidth={1.5} />
            <h3>Precautions</h3>
            <ul>{p.precautions.map((s) => <li key={s}>{s}</li>)}</ul>
          </Reveal>
        </div>
      </section>

      {concerns[0] && (
        <section className="section section--tight">
          <div className="container learn-band" style={{ '--c': concerns[0].color, '--t': concerns[0].tint }}>
            <div>
              <p className="eyebrow">Learn more</p>
              <h3>{concerns[0].body.title}</h3>
              <p>{concerns[0].intro}</p>
            </div>
            <Link to={`/concerns/${concerns[0].id}`} className="btn">Read the {concerns[0].short.toLowerCase()} guide</Link>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container faq-home">
          <SectionHead eyebrow="FAQs" title="Questions about this product" />
          <Accordion items={p.faqs} />
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
            <div className="reads__list m-scroll">
              {reads.map((a) => (
                <Link key={a.id} to={`/journal/${a.id}`} className="read">
                  <span className="read__img"><img src={a.image} alt="" loading="lazy" /></span>
                  <span className="read__body">
                    <span className="acard__meta">{a.category} · {a.readTime}</span>
                    <strong>{a.title}</strong>
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

      <section className="section section--sand">
        <div className="container">
          <SectionHead eyebrow="You may also like" title="Complete your routine" />
          <div className="grid-products">
            {related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </div>
      </section>

      <div className="sticky-buy">
        <img src={p.images[0]} alt="" />
        <span><strong>{p.short}</strong><small>{inr(unit)}</small></span>
        <button className="btn" onClick={() => add(p.id, qty, pack)}>Add to cart</button>
      </div>
    </div>
  );
}
