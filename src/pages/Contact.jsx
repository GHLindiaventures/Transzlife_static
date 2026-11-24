import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Send, PhoneCall, Headset, Navigation, MessageCircle, Plus, Check, ArrowLeft } from 'lucide-react';
import { CONTACT, PHOTOS, PRODUCTS, PHOTO_EXT } from '../content/site.js';
import '../styles/contact.css';

const BASE = import.meta.env.BASE_URL;
const telHref = (n) => `tel:${n.replace(/[^\d+]/g, '')}`;
const waHref = (text) => `https://wa.me/${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.mapQuery)}`;
const mapsEmbed = `https://www.google.com/maps?q=${encodeURIComponent(CONTACT.mapQuery)}&output=embed`;

const EMPTY = { name: '', email: '', phone: '', topic: '', city: '', product: '', method: 'Phone', message: '', consent: false };

/** Plain-text version of the enquiry, used for the WhatsApp / email hand-off. */
function enquiryText(v) {
  return [
    `New enquiry from the TranzLife website`,
    `Name: ${v.name}`,
    `Email: ${v.email}`,
    `Phone: +91 ${v.phone}`,
    v.topic && `Topic: ${v.topic}`,
    v.product && `Product: ${v.product}`,
    v.city && `City: ${v.city}`,
    `Preferred contact: ${v.method}`,
    v.message && `\n${v.message}`,
  ].filter(Boolean).join('\n');
}

function validate(v) {
  const e = {};
  if (!v.name.trim()) e.name = 'Please enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Please enter a valid email address.';
  if (!/^[6-9]\d{9}$/.test(v.phone.replace(/\s/g, ''))) e.phone = 'Please enter a 10-digit mobile number.';
  if (!v.consent) e.consent = 'Please accept the Privacy Policy so we can contact you.';
  return e;
}

/* ---------------- enquiry form ---------------- */
function EnquiryForm() {
  // "Contact our team" in the Tulsi chat arrives with a starter message
  const { state } = useLocation();
  const [v, setV] = useState(() => ({ ...EMPTY, message: state?.chatMessage || '' }));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | handoff
  const id = useId();
  const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) {
      e.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    // With a form endpoint configured (VITE_CONTACT_ENDPOINT), send it there.
    // Without one, hand the enquiry to WhatsApp or email so it is never lost.
    if (!endpoint) { setStatus('handoff'); return; }
    setStatus('sending');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(v) });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
    } catch {
      setStatus('handoff');
    }
  };

  const field = (k, label, input, { required, hint } = {}) => (
    <div className={`ct-field ${errors[k] ? 'has-err' : ''}`}>
      <label htmlFor={`${id}-${k}`}>{label}{required && <em aria-hidden="true"> *</em>}</label>
      {input}
      {hint}
      {errors[k] && <p className="ct-err" id={`${id}-${k}-err`}>{errors[k]}</p>}
    </div>
  );
  const aria = (k) => ({ id: `${id}-${k}`, 'aria-invalid': errors[k] ? 'true' : undefined, 'aria-describedby': errors[k] ? `${id}-${k}-err` : undefined });

  if (status === 'sent' || status === 'handoff') {
    const text = enquiryText(v);
    const mail = `mailto:${CONTACT.emails[0].value}?subject=${encodeURIComponent(`Website enquiry${v.topic ? `: ${v.topic}` : ''}`)}&body=${encodeURIComponent(text)}`;
    return (
      <div className="ct-done" role="status">
        <span className="ct-done__ic"><Check size={30} /></span>
        {status === 'sent' ? (
          <>
            <h2>Thank you, {v.name.split(' ')[0]}!</h2>
            <p>Your enquiry has reached our team. We will contact you by {v.method.toLowerCase()} during working hours.</p>
          </>
        ) : (
          <>
            <h2>Almost done</h2>
            <p>Choose how to send your enquiry. Your details are already filled in, just press send.</p>
            <div className="ct-done__acts">
              <a className="ct-btn ct-btn--wa" href={waHref(text)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Send on WhatsApp</a>
              <a className="ct-btn ct-btn--line" href={mail}><Mail size={18} /> Send by email</a>
            </div>
          </>
        )}
        <button type="button" className="ct-back" onClick={() => { setStatus('idle'); if (status === 'sent') setV(EMPTY); }}><ArrowLeft size={16} /> {status === 'sent' ? 'Send another enquiry' : 'Edit my details'}</button>
      </div>
    );
  }

  return (
    <form className="ct-form" onSubmit={onSubmit} noValidate>
      <div className="ct-form__head">
        <h2>{CONTACT.form.title}</h2>
        <p>{CONTACT.form.text}</p>
      </div>

      {field('name', 'Full Name', <input {...aria('name')} value={v.name} onChange={set('name')} autoComplete="name" placeholder="Your full name" />, { required: true })}

      <div className="ct-row">
        {field('email', 'Email Address', <input {...aria('email')} type="email" value={v.email} onChange={set('email')} autoComplete="email" placeholder="you@email.com" />, { required: true })}
        {field('phone', 'Phone Number', (
          <div className="ct-phone">
            <span aria-hidden="true">+91</span>
            <input {...aria('phone')} type="tel" inputMode="numeric" maxLength={11} value={v.phone} onChange={set('phone')} autoComplete="tel-national" placeholder="XXXXX XXXXX" />
          </div>
        ), { required: true })}
      </div>

      <div className="ct-row">
        {field('topic', 'Enquiry Type', (
          <select {...aria('topic')} value={v.topic} onChange={set('topic')}>
            <option value="">Select enquiry type</option>
            {CONTACT.form.topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        ))}
        {field('city', 'City', <input {...aria('city')} value={v.city} onChange={set('city')} autoComplete="address-level2" placeholder="e.g. Chennai, Bengaluru" />)}
      </div>

      {field('product', 'Product of Interest', (
        <select {...aria('product')} value={v.product} onChange={set('product')}>
          <option value="">Select a product</option>
          {PRODUCTS.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          <option>Not sure yet</option>
        </select>
      ))}

      <fieldset className="ct-field ct-radios">
        <legend>Preferred Contact Method</legend>
        <div>
          {CONTACT.form.methods.map((m) => (
            <label key={m} className="ct-radio">
              <input type="radio" name={`${id}-method`} value={m} checked={v.method === m} onChange={set('method')} />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {field('message', 'Message', <textarea {...aria('message')} rows={4} value={v.message} onChange={set('message')} maxLength={1500} placeholder="Tell us what you would like to know, or how we can help…" />)}

      <div className={`ct-field ${errors.consent ? 'has-err' : ''}`}>
        <label className="ct-check">
          <input type="checkbox" checked={v.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} aria-describedby={errors.consent ? `${id}-consent-err` : undefined} />
          <span>I agree to the <Link to="/policies/privacy">Privacy Policy</Link> and consent to being contacted. <em aria-hidden="true">*</em></span>
        </label>
        {errors.consent && <p className="ct-err" id={`${id}-consent-err`}>{errors.consent}</p>}
      </div>

      <button type="submit" className="ct-submit" disabled={status === 'sending'}>
        <Send size={18} /> {status === 'sending' ? 'Sending…' : CONTACT.form.send}
      </button>
    </form>
  );
}

/* ---------------- contact information ---------------- */
function InfoItem({ icon: Icon, title, children }) {
  return (
    <li className="ct-info__item">
      <span className="ct-info__ic" aria-hidden="true"><Icon size={20} /></span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </li>
  );
}

function ContactInfo() {
  return (
    <aside className="ct-info ct-glow ct-glow--gold" aria-labelledby="ct-info-title">
      <h2 id="ct-info-title">Contact Information</h2>
      <ul className="ct-info__list">
        {CONTACT.offices.map((o) => (
          <InfoItem key={o.title} icon={MapPin} title={o.title}><p>{o.text}</p></InfoItem>
        ))}
        <InfoItem icon={Phone} title="Phone">
          {CONTACT.phones.map((n) => <a key={n} href={telHref(n)}>{n}</a>)}
        </InfoItem>
        <InfoItem icon={Mail} title="Email">
          {CONTACT.emails.map((m) => <a key={m.value} href={`mailto:${m.value}`}>{m.value} <small>· {m.label}</small></a>)}
        </InfoItem>
        <InfoItem icon={Clock} title="Office Hours">
          {CONTACT.hours.map((h) => <p key={h}>{h}</p>)}
        </InfoItem>
      </ul>

      <div className="ct-map">
        <iframe title="Map: TranzLife Biosciences head office, Egmore, Chennai" src={mapsEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>

      <h3 className="ct-connect__title">Connect With Us</h3>
      <div className="ct-connect">
        <a className="ct-cbtn ct-cbtn--call" href={telHref(CONTACT.phones[0])}><PhoneCall size={17} /> Direct Call</a>
        <a className="ct-cbtn ct-cbtn--mail" href={`mailto:${CONTACT.emails[0].value}`}><Mail size={17} /> Email Us</a>
        <a className="ct-cbtn ct-cbtn--care" href={`mailto:${CONTACT.emails[1].value}`}><Headset size={17} /> Support</a>
        <a className="ct-cbtn ct-cbtn--map" href={mapsLink} target="_blank" rel="noreferrer"><Navigation size={17} /> Directions</a>
        <a className="ct-cbtn ct-cbtn--wa" href={waHref('Hi TranzLife, I have a question.')} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Chat on WhatsApp</a>
      </div>
    </aside>
  );
}

/* ---------------- FAQ ---------------- */
function Faq() {
  const [open, setOpen] = useState(-1);
  const id = useId();
  return (
    <section className="ct-faq" aria-labelledby={`${id}-t`}>
      <p className="ct-eyebrow">FAQ</p>
      <h2 id={`${id}-t`}>{CONTACT.faqTitle}</h2>
      <div className="ct-faq__list">
        {CONTACT.faqs.map((f, i) => {
          const on = open === i;
          return (
            <div key={f.q} data-reveal><div className={`ct-faq__item ct-glow ${on ? 'is-on' : ''}`}>
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`${id}-a${i}`} id={`${id}-q${i}`} onClick={() => setOpen(on ? -1 : i)}>
                  <span>{f.q}</span>
                  <Plus size={18} aria-hidden="true" />
                </button>
              </h3>
              <div className="ct-faq__a" id={`${id}-a${i}`} role="region" aria-labelledby={`${id}-q${i}`} inert={on ? undefined : ''}>
                <div><p>{f.a}</p></div>
              </div>
            </div></div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- page ---------------- */
export default function Contact() {
  const photo = PHOTOS.contactBanner;
  return (
    <div className="ct">
      <section className="ct-hero">
        <img className="ct-hero__bg" src={`${BASE}assets/photos/${photo}.${PHOTO_EXT[photo] || 'jpg'}`} alt="" fetchpriority="high" />
        <div className="ct-hero__shade" aria-hidden="true" />
        <div className="ct-hero__card">
          <p className="ct-eyebrow">{CONTACT.eyebrow}</p>
          <h1><span>{CONTACT.title[0]}</span> {CONTACT.title[1]}</h1>
          <p>{CONTACT.text}</p>
        </div>
      </section>

      <section className="ct-main">
        <div data-reveal><div className="ct-main__form ct-glow"><EnquiryForm /></div></div>
        <div data-reveal><ContactInfo /></div>
      </section>

      <Faq />

      <a className="ct-wastrip" href={waHref('Hi TranzLife, I have a question.')} target="_blank" rel="noreferrer">
        <MessageCircle size={20} /> {CONTACT.whatsappStrip}
      </a>
    </div>
  );
}
