import { useState } from 'react';
import { Slot, range } from '../components/ui.jsx';
import { Sep, PageBanner } from '../components/sections/Blocks.jsx';

const COUNT = 10;

export default function Faq() {
  const [open, setOpen] = useState(null); // index of the open question (one at a time)
  return (
    <>
      <PageBanner />
      <section className="faq">
        <div className="faq__list">
          {range(COUNT).map((i) => {
            const isOpen = open === i;
            return (
              <div className={`faq__item${isOpen ? ' is-open' : ''}`} data-reveal key={i}>
                <button className="faq__q" type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <Slot className="slot--q-num" />
                  <Slot className="slot--q" />
                  <span className="faq__plus" aria-hidden="true" />
                </button>
                <div className="faq__a"><div><Slot as="p" /></div></div>
              </div>
            );
          })}
        </div>
      </section>
      <Sep />
    </>
  );
}
