import { useRef } from 'react';
import { ProductImg } from './ui.jsx';
import { LEAF, Sprig, Wreath } from './Botanical.jsx';
import useCompare from '../hooks/useCompare.js';

const BASE = import.meta.env.BASE_URL;
const NAMES = ['product', 'illustration']; // stable reference for the hook

const ICONS = {
  drop: <><path d="M12 3c4 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 2-7 6-10z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  spark: <><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M5 19l2.8-2.8M16.2 7.8 19 5" /></>,
  cycle: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v4h-4" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  leaf: <><path d="M5 19C6 10 12 5 20 4c-.5 9-6 14-15 15z" /><path d="M5 19 14 10" /></>,
};

/**
 * Product showcase (port of the product-page comparison stage).
 * Left layer: the product. Right layer: a conceptual illustration. A handle slides between them
 * (drag, tap, or arrow keys); once, when first seen, it sweeps to show it can be moved.
 */
export default function ProductShowcase({ product, data }) {
  const stageRef = useRef(null);
  const handleRef = useRef(null);

  useCompare(stageRef, handleRef, NAMES);

  const tags = (list, side) => list.map((t, i) => <li className={`psc-tag psc-tag--${side}`} key={t} style={{ '--i': i }}>{t}</li>);

  return (
    <section className="psc-band" aria-label={`${product.short} showcase`}>
      <div className="psc-wrap">
        <div className="psc-head">
          <div>
            <p className="psc-eyebrow">{data.eyebrow}</p>
            <h2 className="psc-h2">{data.title[0]} <em>{data.title[1]}</em></h2>
          </div>
          <p className="psc-sub">{data.intro}</p>
        </div>

        <div className="psc-stage" ref={stageRef} style={{ '--pos': 50 }} aria-roledescription="product and illustration comparison">
          {/* left: the product, unchanged */}
          <div className="psc-layer psc-product">
            <div className="psc-bg" aria-hidden="true"><span className="psc-warm" /><span className="psc-shadow" /></div>
            <div className="psc-pack"><ProductImg n={product.photo} alt={`${product.name} packaging`} eager /></div>
            <ul className="psc-tags" aria-label={data.left.label}>{tags(data.left.tags, 'left')}</ul>
          </div>

          {/* right: the conceptual illustration (clipped from the handle to the right) */}
          <div className="psc-layer psc-illus">
            <div className="psc-bg" aria-hidden="true">
              <span className="psc-glow" />
              <Wreath className="psc-wreath" />
              <svg className="psc-leaf psc-leaf--a" viewBox="0 0 64 64">{LEAF}</svg>
              <svg className="psc-leaf psc-leaf--b" viewBox="0 0 64 64">{LEAF}</svg>
              <svg className="psc-leaf psc-leaf--c" viewBox="0 0 64 64">{LEAF}</svg>
              <Sprig className="psc-sprig psc-sprig--l" />
              <Sprig className="psc-sprig psc-sprig--r" />
              <span className="psc-dots" />
            </div>
            <img
              className="psc-art"
              src={`${BASE}assets/${data.right.image}`}
              alt={data.right.alt}
              width="1200"
              height="820"
              loading="lazy"
              decoding="async"
              draggable="false"
            />
            <ul className="psc-tags" aria-label={data.right.label}>{tags(data.right.tags, 'right')}</ul>
          </div>

          <p className="psc-label psc-label--left" aria-hidden="true"><b>{data.left.label}</b><small>{data.left.sub}</small></p>
          <p className="psc-label psc-label--right" aria-hidden="true"><b>{data.right.label}</b><small>{data.right.sub}</small></p>
          <p className="psc-concept" aria-hidden="true">{data.concept}</p>

          <div
            className="psc-handle"
            ref={handleRef}
            role="slider"
            tabIndex={0}
            aria-label="Move between the product and its conceptual illustration: drag or use the arrow keys"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="50"
            aria-valuetext="Half product, half illustration"
          >
            <span className="psc-line" aria-hidden="true" />
            <span className="psc-knob" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 6 3 12l6 6M15 6l6 6-6 6" /></svg>
            </span>
          </div>
        </div>

        <p className="psc-caption" aria-hidden="true">{data.concept} · drag to explore</p>

        <ul className="psc-benefits">
          {data.benefits.map(([t, d, icon]) => (
            <li key={t}>
              <span className="psc-ic" aria-hidden="true"><svg viewBox="0 0 24 24">{ICONS[icon] || ICONS.leaf}</svg></span>
              <b>{t}</b>
              <span className="psc-bd">{d}</span>
            </li>
          ))}
        </ul>

        <div className="psc-herbs">
          <p className="psc-herbs__k">{data.botanicalsTitle}</p>
          <ul>{data.botanicals.map(([n, q]) => <li key={n}>{n} <small>{q}</small></li>)}</ul>
        </div>

        <p className="psc-note">{data.note}</p>
      </div>
    </section>
  );
}
