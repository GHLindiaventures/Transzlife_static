import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Stethoscope, Lightbulb, Activity } from 'lucide-react';
import { getConcern, CONCERNS } from '../data/concerns';
import { PRODUCTS } from '../data/products';
import { useCatalog } from '../lib/catalog';
import { blogUrl, readTime, useBlogList } from '../lib/blog';
import { getIngredient, getIngredientImg, INGREDIENT_TYPES } from '../data/ingredients';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { Breadcrumbs, Reveal, SectionHead, useTitle } from '../components/Common';
import NotFound from './NotFound';

export function ConcernsIndex() {
  useCatalog();
  useTitle('Shop by concern', 'Find the right TranzLife product by health concern: breathing, liver, energy, period comfort, blood sugar, stress or quitting smoking.');
  return (
    <>
      <section className="shop-hero">
        <div className="container">
          <Breadcrumbs items={[['Shop by concern']]} />
          <h1>Shop by concern</h1>
          <p>Simple guides to how your body works, everyday habits that help, and the TranzLife products made for each goal.</p>
        </div>
      </section>
      <section className="section section--tight">
        <div className="container concern-cards">
          {CONCERNS.map((c, k) => (
            <Reveal key={c.id} delay={k * 50}>
              <Link to={`/concerns/${c.id}`} className="ccard" style={{ '--c': c.color, '--t': c.tint }}>
                <span className="ccard__img"><img src={c.image} alt="" loading="lazy" /></span>
                <span className="ccard__body">
                  <span className="concern__icon"><Icon name={c.icon} /></span>
                  <strong>{c.title}</strong>
                  <small>{c.blurb}</small>
                  <span className="concern__go">Read guide & shop <ArrowRight size={14} /></span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

export default function Concern() {
  useCatalog();
  const { id } = useParams();
  const c = getConcern(id);
  useTitle(c?.title, c?.intro?.slice(0, 160));
  const blog = useBlogList();
  if (!c) return <NotFound />;

  const products = PRODUCTS.filter((p) => p.concerns.includes(c.id));
  const ingIds = [...new Set(products.flatMap((p) => p.ingredients))].slice(0, 8);
  const articles = (blog?.posts || []).filter((a) => a.concern === c.id).slice(0, 6);

  return (
    <div style={{ '--c': c.color, '--t': c.tint }}>
      <section className="chero">
        <div className="container chero__inner">
          <div>
            <Breadcrumbs items={[['Concerns', '/concerns'], [c.title]]} />
            <span className="chero__icon"><Icon name={c.icon} size={30} /></span>
            <h1>{c.title}</h1>
            <p className="chero__text">{c.intro}</p>
            <a href="#products" className="btn">Shop {c.short.toLowerCase()} products <ArrowRight size={16} /></a>
          </div>
          <img src={c.image} alt="" className="chero__img" />
        </div>
      </section>

      <section className="section">
        <div className="container body-sci">
          <Reveal>
            <p className="eyebrow">Understand your body</p>
            <h2>{c.body.title}</h2>
            <p className="lead">{c.body.text}</p>
          </Reveal>
          <Reveal className="facts" delay={100}>
            {c.body.points.map((pt) => <p key={pt}><Activity size={18} /> {pt}</p>)}
          </Reveal>
        </div>
      </section>

      <section className="section section--sand">
        <div className="container tri">
          <Reveal className="tri__card">
            <h3>Common signs</h3>
            <ul>{c.signs.map((s) => <li key={s}>{s}</li>)}</ul>
          </Reveal>
          <Reveal className="tri__card tri__card--good" delay={80}>
            <h3><Lightbulb size={20} /> Daily habits that help</h3>
            <ul className="ticks">{c.habits.map((s) => <li key={s}><Check size={16} /> {s}</li>)}</ul>
          </Reveal>
          <Reveal className="tri__card tri__card--doc" delay={160}>
            <h3><Stethoscope size={20} /> When to see a doctor</h3>
            <p>{c.doctor}</p>
          </Reveal>
        </div>
      </section>

      <section className="section" id="products">
        <div className="container">
          <SectionHead eyebrow="Made for this goal" title={`TranzLife for ${c.short.toLowerCase()}`} text="Our products are designed to support a healthy routine alongside the habits above. They do not replace medical treatment." />
          <div className="grid-products grid-products--3">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {ingIds.length > 0 && (
        <section className="section section--tight">
          <div className="container">
            <SectionHead eyebrow="Key botanicals" title="Ingredients in these products" />
            <div className="ings">
              {ingIds.map((iid) => {
                const ing = getIngredient(iid);
                return (
                  <Link key={iid} to={`/ingredients#${iid}`} className="ing">
                    <span className="ing__thumb" aria-hidden="true">
                      <img
                        src={getIngredientImg(ing.id)}
                        alt={ing.name}
                        className="ing__img"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            e.currentTarget.nextElementSibling.style.display = 'grid';
                          }
                        }}
                      />
                      <span className="ing__dot ing__dot--fallback" style={{ background: INGREDIENT_TYPES[ing.type].color, display: 'none' }}>
                        {ing.name.charAt(0)}
                      </span>
                    </span>
                    <span><strong>{ing.name}</strong><small>{ing.alt}</small></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section className="section section--sand">
          <div className="container">
            <SectionHead eyebrow="Read next" title="From our blogs" />
            <div className="grid-3">
              {articles.map((a) => (
                <Link key={a.slug} to={blogUrl(a.slug)} className="acard">
                  <span className="acard__img">{a.image && <img src={a.image} alt="" loading="lazy" decoding="async" />}</span>
                  <span className="acard__meta">{[a.category?.name, readTime(a.readingMinutes)].filter(Boolean).join(' · ')}</span>
                  <h3>{a.title}</h3>
                  <p>{a.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section section--tight">
        <div className="container">
          <p className="eyebrow">Other concerns</p>
          <div className="chips-row">
            {CONCERNS.filter((x) => x.id !== c.id).map((x) => (
              <Link key={x.id} to={`/concerns/${x.id}`} className="chip chip--lg" style={{ '--c': x.color }}><Icon name={x.icon} size={16} /> {x.title}</Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
