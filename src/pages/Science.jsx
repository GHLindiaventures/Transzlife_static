import { Fragment } from 'react';
import { Sep, PageBanner, Intro, Features, Note, Row, BgVideo, Strip, Newsletter } from '../components/sections/Blocks.jsx';
import { SCIENCE, PHOTOS } from '../content/site.js';

export default function Science() {
  return (
    <>
      <PageBanner variant="dark" title={SCIENCE.banner} photo={PHOTOS.scienceBanner} />
      <Intro title={SCIENCE.intro.title} />
      <Features cls="pfeat--science" items={SCIENCE.stats} />
      <Note title={SCIENCE.note.title} text={SCIENCE.note.text} />
      {SCIENCE.pillars.map((p, i) => (
        <Fragment key={p.title}>
          {i > 0 && <Sep />}
          <Row reverse={i % 2 === 1} mod="tall" title={p.title} text={p.text} photo={p.photo} />
        </Fragment>
      ))}
      <Note title={SCIENCE.cta.title} text={SCIENCE.cta.text} button={SCIENCE.cta.button} />
      <BgVideo small photo={SCIENCE.video.photo} eyebrow={SCIENCE.video.eyebrow} title={SCIENCE.video.title} />
      <Strip />
      <Newsletter small />
    </>
  );
}
