import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, Leaf, FlaskConical } from 'lucide-react';
import { CERTIFICATIONS } from '../data/site';
import { Accordion as UIAccordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion.jsx';
import LogoLoop from './rb/LogoLoop';

// Fade/slide content in when it scrolls into view.
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${on ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHead({ eyebrow, title, text, action, center }) {
  return (
    <div className={`shead ${center ? 'shead--center' : ''}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {text && <p className="shead__text">{text}</p>}
      </div>
      {action}
    </div>
  );
}

// FAQ list built on shadcn/ui Accordion (Radix): keyboard support and smooth height animation.
export function Accordion({ items, defaultOpen = 0 }) {
  return (
    <UIAccordion type="single" collapsible defaultValue={defaultOpen >= 0 ? `q${defaultOpen}` : undefined} className="acc">
      {items.map(([q, a], i) => (
        <AccordionItem key={q} value={`q${i}`} className="acc__item">
          <AccordionTrigger className="acc__q">{q}</AccordionTrigger>
          <AccordionContent className="acc__a">{typeof a === 'string' ? <p>{a}</p> : a}</AccordionContent>
        </AccordionItem>
      ))}
    </UIAccordion>
  );
}

export function TrustRow() {
  const items = [
    [Leaf, 'Plant-based', 'Botanical formulations'],
    [FlaskConical, 'Science-led', 'Developed by our R&D team'],
    [ShieldCheck, 'Quality assured', 'Made to strict standards'],
    [Truck, 'Fast delivery', 'Pan-India shipping'],
  ];
  return (
    <div className="trust">
      {items.map(([I, t, s]) => (
        <div key={t} className="trust__item"><I size={26} strokeWidth={1.5} /><span><strong>{t}</strong><small>{s}</small></span></div>
      ))}
    </div>
  );
}

export function CertStrip({ title = 'Recognised & registered with' }) {
  const [small] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches);
  return (
    <div className="certs">
      <p className="eyebrow">{title}</p>
      <LogoLoop
        logos={CERTIFICATIONS.map((c) => ({ src: c.img, alt: c.name, title: c.name }))}
        speed={34}
        logoHeight={small ? 40 : 58}
        gap={small ? 34 : 89}
        intro={false}
        pauseOnHover
        fadeOut
        draggable={false}
        ariaLabel="Certifications and registrations"
        className="certs__loop"
      />
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      {items.map(([label, to]) => (
        <span key={label}>
          <span aria-hidden="true">/</span>
          {to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function PageHero({ eyebrow, title, text, image, tint }) {
  return (
    <section className="phero" style={{ '--tint': tint || 'var(--sand)' }}>
      <div className="container phero__inner">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {text && <p className="phero__text">{text}</p>}
        </div>
        {image && <img src={image} alt="" className="phero__img" />}
      </div>
    </section>
  );
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | TranzLife Biosciences` : 'TranzLife Biosciences | Plant-Powered Wellness, Backed by Science';
  }, [title]);
}
