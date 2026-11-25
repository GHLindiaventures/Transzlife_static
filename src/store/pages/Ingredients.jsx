import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { INGREDIENTS, INGREDIENT_TYPES, getIngredientImg } from '../data/ingredients';
import { PRODUCTS } from '../data/products';
import { useCatalog } from '../lib/catalog';
import { Breadcrumbs, useTitle } from '../components/Common';
import IngredientCarousel from '../../components/IngredientCarousel';

export default function Ingredients() {
  useCatalog();
  useTitle('Ingredient library');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('is-flash');
        setTimeout(() => el.classList.remove('is-flash'), 2200);
      }, 150);
    }
  }, [hash]);

  const list = useMemo(
    () => INGREDIENTS.filter((i) => (!type || i.type === type) && (!q || (i.name + i.alt + i.latin + i.note).toLowerCase().includes(q.toLowerCase()))),
    [type, q],
  );

  const usedIn = (id) => PRODUCTS.filter((p) => p.ingredients.includes(id));

  return (
    <>
      <div className="container ing-breadcrumb-wrap" style={{ paddingTop: '20px', paddingBottom: '4px' }}>
        <Breadcrumbs items={[['Ingredients']]} />
      </div>

      {/* 3D Botanical Ingredient Carousel Showcase */}
      <IngredientCarousel />

      <section className="container ing-tools" id="directory">
        <div className="tabs">
          <button className={!type ? 'is-active' : ''} onClick={() => setType('')}>All ({INGREDIENTS.length})</button>
          {Object.entries(INGREDIENT_TYPES).map(([k, v]) => (
            <button key={k} className={type === k ? 'is-active' : ''} onClick={() => setType(k)}>{v.label}s</button>
          ))}
        </div>
        <label className="ing-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search e.g. tulsi, amla, liver" aria-label="Search ingredients" />
        </label>
      </section>
      <section className="container ing-grid">
        {list.map((i) => (
          <article key={i.id} id={i.id} className="ingcard" style={{ '--c': INGREDIENT_TYPES[i.type].color }}>
            <div className="ingcard__head">
              <span className="ing__thumb" aria-hidden="true">
                <img
                  src={getIngredientImg(i.id)}
                  alt={i.name}
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
                <span className="ing__dot ing__dot--fallback" style={{ display: 'none' }}>
                  {i.name.charAt(0)}
                </span>
              </span>
              <div>
                <h2>{i.name}</h2>
                <p>{i.alt}{i.latin && <> · <i>{i.latin}</i></>}</p>
              </div>
            </div>
            <span className="ingcard__type">{INGREDIENT_TYPES[i.type].label}{i.part && ` · ${i.part}`}</span>
            <p className="ingcard__note">{i.note}</p>
            <div className="ingcard__used">
              <small>Found in</small>
              {usedIn(i.id).map((p) => <Link key={p.id} to={`/products/${p.id}`} className="chip">{p.short}</Link>)}
            </div>
          </article>
        ))}
        {list.length === 0 && <p className="empty">No ingredients match your search.</p>}
      </section>
      <section className="container note-block">
        <p>
          Traditional-use notes describe how an ingredient has historically been used in Ayurveda, Siddha, homeopathy or folk practice. They are shared for education and are not claims about what a TranzLife product will do for you.
        </p>
      </section>
    </>
  );
}
