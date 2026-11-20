import { Media, Slot } from '../components/ui.jsx';
import { Sep, PageBanner } from '../components/sections/Blocks.jsx';
import { CONTACT, PHOTOS } from '../content/site.js';

export default function Contact() {
  // TODO: wire the form to your backend / form service. Currently it only prevents the page reload.
  const onSubmit = (e) => e.preventDefault();
  const f = CONTACT.fields;

  return (
    <>
      <PageBanner title={CONTACT.banner} photo={PHOTOS.contactBanner} />
      <section className="cform">
        <div data-reveal>
          <Slot as="h2" className="slot--c-title">{CONTACT.title}</Slot>
          <Slot as="p" className="slot--c-text">{CONTACT.text}</Slot>
          <form className="cform__form" onSubmit={onSubmit} noValidate>
            <label className="field"><span className="visually-hidden">{f.name}</span><input type="text" name="name" autoComplete="name" placeholder={f.name} /></label>
            <label className="field"><span className="visually-hidden">{f.phone}</span><input type="tel" name="phone" autoComplete="tel" placeholder={f.phone} /></label>
            <label className="field full"><span className="visually-hidden">{f.email}</span><input type="email" name="email" autoComplete="email" required placeholder={f.email} /></label>
            <label className="field full"><span className="visually-hidden">{f.message}</span><textarea name="message" placeholder={f.message} /></label>
            <button className="btn btn--dark" type="submit"><Slot className="slot--btn-sm">{f.send}</Slot></button>
          </form>
        </div>
      </section>
      <Sep />
      <section className="iwt cinfo">
        <div className="iwt__media"><Media className="media--fill" photo={PHOTOS.contactSide} data-reveal /></div>
        <div className="iwt__text" data-reveal>
          {CONTACT.info.map((g) => (
            <div className="cinfo__group" key={g.title}>
              <Slot as="h3" className="slot--ci-title">{g.title}</Slot>
              <Slot as="p" className="slot--ci-text">{g.text}</Slot>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
