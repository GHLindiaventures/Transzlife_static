import { Media, Slot, range } from '../components/ui.jsx';
import { Sep, PageBanner } from '../components/sections/Blocks.jsx';

export default function Contact() {
  // TODO: wire the form to your backend / form service. Currently it only prevents the page reload.
  const onSubmit = (e) => e.preventDefault();

  return (
    <>
      <PageBanner />
      <section className="cform">
        <div data-reveal>
          <Slot as="h2" className="slot--c-title" />
          <Slot as="p" className="slot--c-text" />
          <form className="cform__form" onSubmit={onSubmit} noValidate>
            <label className="field"><span className="visually-hidden">Name</span><input type="text" name="name" autoComplete="name" /></label>
            <label className="field"><span className="visually-hidden">Phone</span><input type="tel" name="phone" autoComplete="tel" /></label>
            <label className="field full"><span className="visually-hidden">Email</span><input type="email" name="email" autoComplete="email" required /></label>
            <label className="field full"><span className="visually-hidden">Message</span><textarea name="message" /></label>
            <button className="btn btn--dark" type="submit"><Slot className="slot--btn-sm" /></button>
          </form>
        </div>
      </section>
      <Sep />
      <section className="iwt cinfo">
        <div className="iwt__media"><Media className="media--fill" data-reveal /></div>
        <div className="iwt__text" data-reveal>
          {range(4).map((i) => (
            <div className="cinfo__group" key={i}>
              <Slot as="h3" className="slot--ci-title" />
              <Slot as="p" className="slot--ci-text" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
