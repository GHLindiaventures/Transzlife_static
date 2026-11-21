import { useState } from 'react';
import { Slot } from '../components/ui.jsx';
import { Sep, PageBanner } from '../components/sections/Blocks.jsx';
import { FAQ, PHOTOS } from '../content/site.js';

export default function Faq() {
  const [open, setOpen] = useState(null); // index of the open question (one at a time)
  return (
    <>
      <section className="faq-hero">
        <div className="faq-hero__image">
          <img src="/assets/photos/faq-meeting.png" alt="FAQ" />
          <div className="faq-hero__text">FAQ</div>
        </div>
      </section>
      <section className="faq">
        <div className="faq__list">
          {FAQ.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className={`faq__item${isOpen ? ' is-open' : ''}`} data-reveal key={item.q}>
                <button className="faq__q" type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <Slot className="slot--q-num">{`${i + 1}.`}</Slot>
                  <Slot className="slot--q">{item.q}</Slot>
                  <span className="faq__plus" aria-hidden="true" />
                </button>
                <div className="faq__a"><div><Slot as="p">{item.a}</Slot></div></div>
              </div>
            );
          })}
        </div>
      </section>
      <Sep />
    </>
  );
}
