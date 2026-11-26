import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Sprout, Microscope, Factory, PackageCheck, FlaskConical, ShieldCheck, Leaf, HeartHandshake, Target, Eye, Phone, Mail, MapPin, Clock, Check, Dna, BrainCircuit } from 'lucide-react';
import { SITE } from '../data/site';
import { ARTICLES, getArticle } from '../data/articles';
import { getConcern } from '../data/concerns';
import { PRODUCTS } from '../data/products';
import { useCatalog } from '../lib/catalog';
import ProductCard from '../components/ProductCard';
import { Accordion, Breadcrumbs, CertStrip, PageHero, Reveal, SectionHead, useTitle } from '../components/Common';
import { fmtDate } from '../utils/format';
import NotFound from './NotFound';

/* ---------------- Science ---------------- */
const RESEARCH = [
  { icon: BrainCircuit, title: 'Neuro-wellness bioactives', status: 'Discovery & phytochemical profiling', text: 'Studying botanicals such as Bacopa monnieri and Curcuma caesia for their role in neuro-inflammation and cognitive wellness.' },
  { icon: Microscope, title: 'Preventive bioactive programme', status: 'Pre-clinical cellular assays', text: 'Early laboratory evaluation of plant-derived compounds, including acetogenins from Annona muricata (soursop) leaf.' },
  { icon: Dna, title: 'Precision genomics & AI', status: 'Platform conceptualisation', text: 'Exploring biomarker discovery and AI-driven tools to personalise preventive wellness in the future.' },
];

export function Science() {
  useCatalog();
  useTitle('Our science');
  const steps = [
    [Sprout, 'Botanical selection', 'We start from classical Ayurvedic, Siddha and traditional texts, choosing herbs with a long history of use for each wellness goal.'],
    [Microscope, 'Research & formulation', 'Our team reviews published research on each ingredient, then builds a blend and format (liquid, gummy, roll-on, inhaler) that makes the routine easy.'],
    [FlaskConical, 'Quality testing', 'Raw materials and finished batches are checked for identity, quality and safety before release.'],
    [Factory, 'Licensed manufacturing', 'Products are manufactured in licensed facilities under applicable AYUSH, FSSAI or cosmetic regulations.'],
    [PackageCheck, 'Honest labelling', 'Full ingredient lists, clear directions and precautions on every pack and on this website.'],
  ];
  return (
    <>
      <PageHero eyebrow="Our science" title="Nature’s intelligence, refined by science" text="TranzLife Biosciences brings together traditional botanical wisdom and modern research to create everyday wellness products that are simple, honest and easy to use." image="/img/about/lab.webp" />
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Seed to shelf" title="Our five-step process" center />
          <div className="timeline">
            {steps.map(([I, t, d], k) => (
              <Reveal key={t} className="timeline__item" delay={k * 70}>
                <span className="timeline__n">{k + 1}</span>
                <I size={28} strokeWidth={1.5} />
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--forest">
        <div className="container principles">
          <div>
            <p className="eyebrow eyebrow--light">Our principles</p>
            <h2>What we promise, and what we never will</h2>
          </div>
          <ul>
            <li><Check size={18} /> We list every ingredient, openly.</li>
            <li><Check size={18} /> We describe what an ingredient is traditionally used for, and say so clearly.</li>
            <li><Check size={18} /> We encourage you to keep your doctor in the loop.</li>
            <li><Check size={18} /> We never claim our products cure disease or replace medicine.</li>
          </ul>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="R&D pipeline" title="Research for healthier tomorrows" text="Beyond our current range, our biosciences team is exploring long-term research programmes. These are early-stage and not products." />
          <div className="grid-3">
            {RESEARCH.map((r, k) => (
              <Reveal key={r.title} className="rcard" delay={k * 80}>
                <r.icon size={28} strokeWidth={1.5} />
                <span className="tag">{r.status}</span>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--sand"><div className="container"><CertStrip /></div></section>
    </>
  );
}

/* ---------------- About ---------------- */
export function About() {
  useCatalog();
  useTitle('About us');
  const values = [
    [Leaf, 'Rooted in nature', 'Botanicals first, always.'],
    [FlaskConical, 'Led by science', 'Research before every formula.'],
    [ShieldCheck, 'Honest by design', 'Clear labels, no false promises.'],
    [HeartHandshake, 'Care for people', 'Wellness that fits real Indian lives.'],
  ];
  return (
    <>
      <PageHero eyebrow="About TranzLife" title="Innovating life beyond limits" text="We are a Chennai-based biosciences company on a mission to make plant-powered wellness simple, trustworthy and part of everyday life." image="/img/about/hub.webp" />
      <section className="section">
        <div className="container story">
          <Reveal className="story__img"><img src="/img/about/roots.webp" alt="Herbs and a mortar and pestle" loading="lazy" /></Reveal>
          <Reveal delay={100}>
            <p className="eyebrow">Our story</p>
            <h2>Where traditional wisdom meets modern biosciences</h2>
            <p className="lead">India has one of the richest plant-medicine traditions in the world. Tulsi in the courtyard, Keezhanelli for the liver, dill seeds for tummy aches: our grandmothers knew them all.</p>
            <p>TranzLife Biosciences was founded to bring that knowledge into the modern day: carefully researched, made in licensed facilities, honestly labelled, and packed into formats that fit a busy life, from gummies and oral liquids to roll-ons and pocket inhalers.</p>
            <p>Our logo says it best. A tree for nature, rooted in an infinity loop shaped like DNA, for science and for life that keeps renewing itself.</p>
          </Reveal>
        </div>
      </section>
      <section className="section section--sand">
        <div className="container mv">
          <Reveal className="mv__card"><Target size={28} strokeWidth={1.5} /><h3>Our mission</h3><p>To create accessible, plant-powered wellness products that help people feel a little better every day, backed by research and honest communication.</p></Reveal>
          <Reveal className="mv__card" delay={80}><Eye size={28} strokeWidth={1.5} /><h3>Our vision</h3><p>A healthier tomorrow where preventive, nature-inspired wellness and modern science work hand in hand for every Indian family.</p></Reveal>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="What we stand for" title="Our values" center />
          <div className="pillars__grid">
            {values.map(([I, t, d], k) => (
              <Reveal key={t} className="pillar" delay={k * 70}><span className="pillar__icon"><I size={26} strokeWidth={1.5} /></span><h3>{t}</h3><p>{d}</p></Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--tight"><div className="container"><CertStrip /></div></section>
      <section className="section">
        <div className="container cta-band">
          <h2>Ready to start your wellness routine?</h2>
          <div><Link to="/shop" className="btn btn--gold btn--lg">Shop the range</Link><Link to="/contact" className="btn btn--lg btn--outline-light">Talk to us</Link></div>
        </div>
      </section>
    </>
  );
}

/* ---------------- Blogs (wellness journal) ---------------- */
export const BLOGS_URL = '/blogs';
export const blogUrl = (id) => `${BLOGS_URL}/${id}`;

/** Inline text: **bold** and *italic*. */
function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((s, i) => (
    s.startsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong>
      : s.startsWith('*') ? <em key={i}>{s.slice(1, -1)}</em>
        : <span key={i}>{s}</span>
  ));
}

/** One body block: paragraph, list, table, callout or FAQ list. */
function Block({ b }) {
  if (typeof b === 'string') return <p><Rich text={b} /></p>;
  if (b.ul) return <ul>{b.ul.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>;
  if (b.ol) return <ol>{b.ol.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ol>;
  if (b.callout) return <p className="article__callout"><Rich text={b.callout} /></p>;
  if (b.table) {
    const [head, ...rows] = b.table;
    return (
      <div className="article__table">
        <table>
          <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}><Rich text={c} /></td>))}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (b.faq) {
    return (
      <dl className="article__faq">
        {b.faq.map(([q, a]) => (
          <div key={q}><dt>{q}</dt><dd><Rich text={a} /></dd></div>
        ))}
      </dl>
    );
  }
  return null;
}
const blocks = (body) => (Array.isArray(body) ? body : [body]);

export function Journal() {
  useCatalog();
  useTitle('Blogs', 'TranzLife blogs: practical, easy-to-read guides on quitting smoking, lung, liver and menstrual wellness, immunity and everyday Ayurvedic habits.');
  const [cat, setCat] = useState('');
  const cats = [...new Set(ARTICLES.map((a) => a.category))];
  const list = ARTICLES.filter((a) => !cat || a.category === cat);
  const [first, ...rest] = list;
  return (
    <>
      <section className="shop-hero">
        <div className="container">
          <Breadcrumbs items={[['Blogs']]} />
          <h1>Blogs</h1>
          <p>Our wellness journal: practical, easy-to-read guides on how your body works and the small habits that help.</p>
        </div>
      </section>
      <section className="container section--tight">
        <div className="tabs">
          <button className={!cat ? 'is-active' : ''} onClick={() => setCat('')}>All</button>
          {cats.map((c) => <button key={c} className={cat === c ? 'is-active' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {first && (
          <Link to={blogUrl(first.id)} className="feature-article">
            <span className="feature-article__img"><img src={first.image} alt="" /></span>
            <span className="feature-article__body">
              <span className="acard__meta">{first.category} · {first.readTime}</span>
              <h2>{first.title}</h2>
              <p>{first.excerpt}</p>
              <span className="link-arrow">Read article <ArrowRight size={16} /></span>
            </span>
          </Link>
        )}
        <div className="grid-3">
          {rest.map((a) => (
            <Link key={a.id} to={blogUrl(a.id)} className="acard">
              <span className="acard__img"><img src={a.image} alt="" loading="lazy" /></span>
              <span className="acard__meta">{a.category} · {a.readTime}</span>
              <h3>{a.title}</h3>
              <p>{a.excerpt}</p>
              <span className="acard__date">{fmtDate(a.date)}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function Article() {
  useCatalog();
  const { id } = useParams();
  const a = getArticle(id);
  useTitle(a?.title, a?.excerpt);
  if (!a) return <NotFound />;
  const concern = getConcern(a.concern);
  const products = PRODUCTS.filter((p) => p.concerns.includes(a.concern)).slice(0, 2);
  // same-topic articles first, then the rest
  const more = ARTICLES.filter((x) => x.id !== a.id)
    .sort((x, y) => (y.concern === a.concern) - (x.concern === a.concern))
    .slice(0, 3);
  return (
    <>
      <article className="article">
        <header className="container article__head">
          <Breadcrumbs items={[['Blogs', BLOGS_URL], [a.category]]} />
          <p className="acard__meta">{a.category} · {a.readTime} · {fmtDate(a.date)}</p>
          <h1>{a.title}</h1>
          <p className="lead">{a.excerpt}</p>
        </header>
        <div className="container article__img"><img src={a.image} alt={a.imageAlt || ''} /></div>
        <div className="container article__layout">
          <div className="article__body">
            {a.intro && <section>{a.intro.map((b, i) => <Block key={i} b={b} />)}</section>}
            {a.sections.map(([h, body], k) => (
              <section key={k}>
                <h2>{h}</h2>
                {blocks(body).map((b, i) => <Block key={i} b={b} />)}
                {(a.figures || []).filter((f) => f.after === k).map((f) => (
                  <figure key={f.src} className="article__figure">
                    <img src={f.src} alt={f.alt} loading="lazy" decoding="async" />
                    {f.caption && <figcaption>{f.caption}</figcaption>}
                  </figure>
                ))}
              </section>
            ))}
            {a.cta && (
              <div className="article__cta">
                <p><Rich text={a.cta.text} /></p>
                <Link to={a.cta.to} className="btn">{a.cta.label} <ArrowRight size={16} /></Link>
              </div>
            )}
            <p className="note">{a.disclaimer || 'This article is for general information only and is not medical advice. Please consult a qualified healthcare professional about your health.'}</p>
          </div>
          <aside className="article__aside">
            {concern && (
              <Link to={`/concerns/${concern.id}`} className="aside-card" style={{ '--c': concern.color, '--t': concern.tint }}>
                <small>Full guide</small><strong>{concern.title}</strong><span className="link-arrow">Read guide <ArrowRight size={14} /></span>
              </Link>
            )}
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </aside>
        </div>
      </article>
      <section className="section section--sand">
        <div className="container">
          <SectionHead eyebrow="Keep reading" title="More blogs" action={<Link to={BLOGS_URL} className="link-arrow">All blogs <ArrowRight size={16} /></Link>} />
          <div className="grid-3">
            {more.map((m) => (
              <Link key={m.id} to={blogUrl(m.id)} className="acard">
                <span className="acard__img"><img src={m.image} alt="" loading="lazy" /></span>
                <span className="acard__meta">{m.category}</span>
                <h3>{m.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- FAQ ---------------- */
const FAQ_GROUPS = [
  ['Products', [
    ['Are your products Ayurvedic?', 'Our range is inspired by Ayurvedic and traditional botanical knowledge. Each product page lists every ingredient, including any micronutrients or homeopathic preparations.'],
    ['Do your products cure diseases?', 'No. TranzLife products are wellness products. They are not intended to diagnose, treat, cure or prevent any disease, and should not replace medicines prescribed by your doctor.'],
    ['Can I take more than one product together?', 'Most people can combine our oral and topical products, but if you take regular medicines or have a medical condition, check with your doctor first.'],
    ['Are they safe during pregnancy?', 'Please consult your doctor before using any wellness product during pregnancy or breastfeeding. Essential-oil products in particular may not be suitable.'],
    ['How should I store the products?', 'Store in a cool, dry place away from direct sunlight, with caps tightly closed, and out of reach of children.'],
  ]],
  ['Orders & delivery', [
    ['How long does delivery take?', 'Orders are dispatched in 1 to 2 working days and usually delivered within 3 to 7 working days, depending on your location.'],
    ['How much is shipping?', `Shipping is free on orders above ₹${SITE.freeShippingAbove}. Below that, a flat fee of ₹${SITE.shippingFee} applies.`],
    ['Do you offer Cash on Delivery?', 'Yes, on most pin codes. Prepaid orders (UPI, cards, net banking) get an extra 5% off.'],
    ['How do I track my order?', 'You will receive tracking details by SMS, WhatsApp and email once your order ships.'],
  ]],
  ['Returns & support', [
    ['Can I return a product?', 'For hygiene reasons, opened wellness products cannot be returned. If your order arrives damaged, leaking or incorrect, contact us within 48 hours with photos and we will replace it or refund you.'],
    ['How do I contact customer care?', `WhatsApp or call us on ${SITE.phone}, or email ${SITE.careEmail}. We are available ${SITE.hours}.`],
  ]],
];

export function Faq() {
  useCatalog();
  useTitle('FAQs');
  return (
    <>
      <PageHero eyebrow="Help centre" title="Frequently asked questions" text="Quick answers about our products, orders and delivery." image="/assets/photos/faq-banner.jpg" />
      <section className="section">
        <div className="container faq-page">
          {FAQ_GROUPS.map(([g, items]) => (
            <div key={g} className="faq-group">
              <h2>{g}</h2>
              <Accordion items={items} defaultOpen={-1} />
            </div>
          ))}
          <div className="learn-band">
            <div><h3>Still have a question?</h3><p>Our wellness team usually replies within a few hours.</p></div>
            <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="btn">Chat on WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- Contact ---------------- */
export function Contact() {
  useCatalog();
  useTitle('Contact us');
  const [sent, setSent] = useState(false);
  const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;
  const onSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (endpoint) {
      try { await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch { /* shown as sent; backend pending */ }
    }
    setSent(true);
  };
  return (
    <>
      <PageHero eyebrow="Contact" title="We are here to help" text="Questions about a product, an order or a bulk enquiry? Reach out and our team will get back to you." image="/assets/photos/contact-banner.jpg" />
      <section className="section">
        <div className="container contact">
          <div className="contact__info">
            <a href={SITE.phoneHref} className="contact__item"><Phone /><span><small>Call or WhatsApp</small><strong>{SITE.phone}</strong></span></a>
            <a href={`mailto:${SITE.email}`} className="contact__item"><Mail /><span><small>General enquiries</small><strong>{SITE.email}</strong></span></a>
            <a href={`mailto:${SITE.careEmail}`} className="contact__item"><Mail /><span><small>Customer care</small><strong>{SITE.careEmail}</strong></span></a>
            <div className="contact__item"><MapPin /><span><small>Head office</small><strong>{SITE.address}</strong></span></div>
            <div className="contact__item"><Clock /><span><small>Hours</small><strong>{SITE.hours}</strong></span></div>
            <iframe title="TranzLife office map" className="contact__map" loading="lazy" src="https://www.google.com/maps?q=Montieth+Road+Egmore+Chennai&output=embed" />
          </div>
          <div className="contact__form-wrap">
            {sent ? (
              <div className="success"><Check size={36} /><h2>Message sent</h2><p>Thank you for reaching out. We will reply within one working day.</p></div>
            ) : (
              <form className="form" onSubmit={onSubmit}>
                <h2>Send us a message</h2>
                <div className="form__row">
                  <label>Full name<input name="name" required autoComplete="name" /></label>
                  <label>Phone<input name="phone" type="tel" required pattern="[0-9+ ]{10,15}" autoComplete="tel" /></label>
                </div>
                <label>Email<input name="email" type="email" required autoComplete="email" /></label>
                <label>Topic
                  <select name="topic" defaultValue="Product question">
                    <option>Product question</option><option>Order support</option><option>Bulk / distributor enquiry</option><option>Feedback</option><option>Other</option>
                  </select>
                </label>
                <label>Message<textarea name="message" rows={5} required /></label>
                <button className="btn btn--lg btn--block">Send message</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- Policies ---------------- */
const POLICIES = {
  shipping: ['Shipping & returns', [
    ['Shipping', `We ship across India. Orders are dispatched within 1 to 2 working days and usually delivered in 3 to 7 working days. Shipping is free on orders above ₹${SITE.freeShippingAbove}; a flat ₹${SITE.shippingFee} fee applies below that.`],
    ['Cash on Delivery', 'COD is available on most pin codes. We may confirm COD orders by phone before dispatch.'],
    ['Damaged or wrong items', 'If your order arrives damaged, leaking or incorrect, please contact us within 48 hours of delivery with photos of the package and product. We will send a replacement or issue a full refund.'],
    ['Returns', 'For hygiene and safety reasons, opened or used products cannot be returned. Unopened products in original packaging may be returned within 7 days of delivery; return shipping may be charged.'],
    ['Refunds', 'Approved refunds are processed to the original payment method within 5 to 7 working days. COD refunds are made by bank transfer or UPI.'],
  ]],
  privacy: ['Privacy policy', [
    ['What we collect', 'When you place an order or contact us, we collect your name, phone number, email, delivery address and order details. Payments are processed by our payment partner; we do not store card details.'],
    ['How we use it', 'To process and deliver orders, provide customer support, and, if you opt in, send cart and refill reminders, wellness tips and offers by SMS or WhatsApp. You can turn reminders off in My account or reply STOP at any time.'],
    ['Site analytics', 'We run our own analytics: no advertising networks, no third-party trackers, and we never store your IP address or fingerprint your device. Without your consent we count page views only, anonymously. If you choose "Accept" in the privacy banner, your browser keeps a random visitor ID so we can tell new from returning visitors, see which products are viewed, added to the cart, saved or shared, and keep your cart so it is not lost. If you are signed in, this activity is linked to your account. Raw activity is deleted after 13 months. You can change your choice any time with "Privacy choices" at the bottom of every page.'],
    ['Reviews', 'Only customers whose order was delivered can review a product. Your review is shown with your first name and the initial of your last name, never your phone number or email. Reviews with links, contact details, medical claims or abusive language are checked by our team before they appear; we never hide a review because it is critical. You can edit your review at any time, and deleting your account removes your reviews.'],
    ['Live visitor counts', 'The "people browsing right now" numbers are real counts of visitors active in the last 90 seconds, worked out on our server and kept only in memory: nothing about this is stored. Small numbers are not shown, and the numbers are never rounded up or made up.'],
    ['Sharing', 'We share only what is necessary with delivery, payment and messaging partners. We never sell your personal data.'],
    ['Your rights', `You can ask us to access, correct or delete your data by writing to ${SITE.email}.`],
  ]],
  terms: ['Terms of use', [
    ['Wellness information', 'Content on this website is for general information and education only. It is not medical advice and should not replace consultation with a qualified healthcare professional.'],
    ['Product use', 'Always read the product label and follow directions and precautions. Our products are not intended to diagnose, treat, cure or prevent any disease.'],
    ['Pricing', 'Prices are in Indian Rupees and include applicable taxes. We may update prices and offers from time to time; the price at checkout applies to your order.'],
    ['Governing law', 'These terms are governed by the laws of India, with courts in Chennai, Tamil Nadu having jurisdiction.'],
  ]],
};

export function Policy() {
  useCatalog();
  const { id } = useParams();
  const pol = POLICIES[id];
  useTitle(pol?.[0]);
  if (!pol) return <NotFound />;
  return (
    <>
      <PageHero eyebrow="Policies" title={pol[0]} text={`Last updated ${fmtDate('2026-11-20')}`} />
      <section className="section">
        <div className="container prose">
          {pol[1].map(([h, t]) => <section key={h}><h2>{h}</h2><p>{t}</p></section>)}
          <p className="note">Questions about this policy? Email {SITE.email}.</p>
        </div>
      </section>
    </>
  );
}
