import { Media, Slot, Ph, range } from '../components/ui.jsx';

export default function Blog() {
  return (
    <section className="blog">
      <Slot as="h1" className="headline slot--headline" />
      <div className="blog__grid">
        {range(9).map((i) => (
          <article className="bcard" data-reveal key={i}>
            <Ph className="bcard__media" aria-label="Read article"><Media /></Ph>
            <Slot as="div" className="slot--bc-meta" />
            <Slot as="h2" className="slot--bc-title" />
            <Slot as="p" className="slot--bc-text" />
            <Ph className="btn btn--dark btn--sm"><Slot /></Ph>
          </article>
        ))}
      </div>
    </section>
  );
}
