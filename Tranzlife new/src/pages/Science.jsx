import { Fragment } from 'react';
import { Sep, PageBanner, Intro, Features, Note, Row, BgVideo, Strip, Newsletter } from '../components/sections/Blocks.jsx';

export default function Science() {
  return (
    <>
      <PageBanner variant="dark" />
      <Intro withText={false} />
      <Features cls="pfeat--science" />
      <Note />
      {[0, 1, 2, 3, 4].map((i) => (
        <Fragment key={i}>
          {i > 0 && <Sep />}
          <Row reverse={i % 2 === 1} mod="tall" />
        </Fragment>
      ))}
      <Note cta />
      <BgVideo small />
      <Strip />
      <Newsletter small />
    </>
  );
}
