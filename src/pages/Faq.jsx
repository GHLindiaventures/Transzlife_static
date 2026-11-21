import { useState } from 'react';
import { Slot } from '../components/ui.jsx';
import { Sep, PageBanner } from '../components/sections/Blocks.jsx';
import { FAQ, PHOTOS } from '../content/site.js';

export default function Faq() {
  const [open, setOpen] = useState(null); // index of the open question (one at a time)
  return (
    <>
      <PageBanner variant="faq" title={FAQ.banner} photo={PHOTOS.faqBanner} />
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
