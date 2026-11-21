import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, TriangleAlert, Plus, MessageCircle, ArrowRight, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip.jsx';
import { INGREDIENT_TYPES } from '../../data/ingredients';

const SHOW = 6; // ingredients shown on phones before "show all"

/** Key ingredients: compact 2-up tiles on phones (first 6, then "show all"), 4-up on desktop. */
export function IngredientGrid({ ings }) {
  const [all, setAll] = useState(false);
  const extra = ings.length - SHOW;
  return (
    <>
      <ul className={`ings2 ${all ? 'is-all' : ''}`}>
        {ings.map((ing, k) => {
          const t = INGREDIENT_TYPES[ing.type];
          return (
            <li key={ing.id} className="ings2__item" style={{ '--d': `${Math.min(k, 11) * 35}ms` }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to={`/ingredients#${ing.id}`} className="ing2">
                    <span className="ing2__dot" style={{ background: t.color }} aria-hidden="true">{ing.name.charAt(0)}</span>
                    <span className="ing2__text">
                      <strong>{ing.name}</strong>
                      <small>{ing.alt}</small>
                    </span>
                    <span className="ing2__type" style={{ '--c': t.color }} title={t.label}>{t.label.split(' ')[0]}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="tip">{ing.note}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {extra > 0 && (
        <button type="button" className="ings2__more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${ings.length} ingredients`} <ChevronDown size={16} />
        </button>
      )}
    </>
  );
}

/** How to use / Who is it for / Precautions: tabs on phones (one panel at a time), three cards on desktop. */
export function UseTabs({ p }) {
  const [tab, setTab] = useState(0);
  const base = useId();
  const panels = [
    { key: 'use', label: 'How to use', short: 'How to use', Icon: Clock, list: p.howToUse, ordered: true },
    { key: 'who', label: 'Who is it for?', short: 'Who it’s for', Icon: Users, list: p.whoFor },
    { key: 'warn', label: 'Precautions', short: 'Precautions', Icon: TriangleAlert, list: p.precautions, warn: true },
  ];
  const onKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = (tab + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length;
    setTab(next);
    document.getElementById(`${base}-t${next}`)?.focus();
  };
  return (
    <div className="usetabs" style={{ '--tab': tab }}>
      <div className="usetabs__bar" role="tablist" aria-label="Product guidance" onKeyDown={onKey}>
        <span className="usetabs__pill" aria-hidden="true" />
        {panels.map((x, i) => (
          <button
            key={x.key} id={`${base}-t${i}`} type="button" role="tab"
            aria-selected={tab === i} aria-controls={`${base}-p${i}`} tabIndex={tab === i ? 0 : -1}
            className={`usetabs__tab ${tab === i ? 'is-on' : ''} ${x.warn ? 'is-warn' : ''}`} onClick={() => setTab(i)}
          >
            <x.Icon size={16} /> {x.short}
          </button>
        ))}
      </div>
      <div className="usetabs__panels">
        {panels.map((x, i) => {
          const L = x.ordered ? 'ol' : 'ul';
          return (
            <div key={x.key} id={`${base}-p${i}`} role="tabpanel" aria-labelledby={`${base}-t${i}`} className={`use-card ${x.warn ? 'use-card--warn' : ''} usetabs__panel ${tab === i ? 'is-on' : ''}`}>
              <x.Icon size={26} strokeWidth={1.5} />
              <h3>{x.label}</h3>
              <L className={`uselist ${x.ordered ? 'uselist--steps' : ''}`}>
                {x.list.map((s) => <li key={s}>{s}</li>)}
              </L>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** FAQ: numbered, smooth open/close (height animates), plus turns into minus. One open at a time. */
export function FaqList({ items }) {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <div className="faq2">
      {items.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className={`faq2__item ${on ? 'is-on' : ''}`} style={{ '--d': `${i * 60}ms` }}>
            <h3 className="faq2__h">
              <button type="button" className="faq2__q" id={`${base}-q${i}`} aria-expanded={on} aria-controls={`${base}-a${i}`} onClick={() => setOpen(on ? -1 : i)}>
                <span className="faq2__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="faq2__text">{q}</span>
                <span className="faq2__icon" aria-hidden="true"><Plus size={18} /></span>
              </button>
            </h3>
            <div className="faq2__a" id={`${base}-a${i}`} role="region" aria-labelledby={`${base}-q${i}`} inert={on ? undefined : ''}>
              <div><p>{a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FaqHelp({ className = '' }) {
  return (
    <div className={`faqhelp ${className}`}>
      <span className="faqhelp__ic" aria-hidden="true"><MessageCircle size={22} /></span>
      <div>
        <strong>Still have a question?</strong>
        <p>Message our wellness team and we will help you choose.</p>
      </div>
      <Link to="/contact" className="link-arrow">Ask us <ArrowRight size={16} /></Link>
    </div>
  );
}
