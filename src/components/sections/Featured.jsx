import { Media, Slot, CtaLink, ProductImg, range } from '../ui.jsx';

export function PriceRow() {
  return (
    <div className="pcard__price">
      <Slot className="slot--price" />
      <Slot className="slot--price" />
      <Slot className="slot--pill" />
    </div>
  );
}

export function ProductCard({ n }) {
  return (
    <article className="pcard" data-reveal>
      <div className="pcard__media">
        <Media className="media--fill media--product">{n ? <ProductImg n={n} /> : null}</Media>
        <Slot className="pcard__badge slot--badge" />
        <button className="pcard__quick" type="button"><Slot className="slot--btn" /></button>
      </div>
      <h3 className="pcard__title"><Slot className="slot--card-title" /></h3>
      <PriceRow />
    </article>
  );
}

/** Product card carousel. `titled` adds the section headline (used on the About page). link: { label, to } */
export default function Featured({ titled = false, photos = true, headline, link }) {
  return (
    <section className={`featured${titled ? ' featured--titled' : ''}`}>
      {titled && <Slot as="h2" className="headline slot--headline" data-reveal>{headline}</Slot>}
      <div className="featured__track" id="featuredTrack">
        {range(4).map((i) => <ProductCard key={i} n={photos ? i + 1 : 0} />)}
      </div>
      <div className="featured__foot">
        <CtaLink to={link?.to} className="link-btn link-btn--dark"><Slot className="slot--link">{link?.label}</Slot></CtaLink>
      </div>
    </section>
  );
}
