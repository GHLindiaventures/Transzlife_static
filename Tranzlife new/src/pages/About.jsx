import Featured from '../components/sections/Featured.jsx';
import { Sep, PageBanner, Intro, Row, BgVideo, Strip, Features, Newsletter } from '../components/sections/Blocks.jsx';
import { ABOUT, MILESTONES, PHOTOS } from '../content/site.js';

export default function About() {
  const [r1, r2, r3] = ABOUT.rows;
  return (
    <>
      <PageBanner variant="about" title={ABOUT.banner} photo={PHOTOS.aboutBanner} />
      <Intro title={ABOUT.intro.title} text={ABOUT.intro.text} />
      <Sep />
      <Row {...r1} />
      <Row reverse {...r2} />
      <Row mod="short" {...r3} />
      <Sep />
      <BgVideo small photo={ABOUT.video.photo} eyebrow={ABOUT.video.eyebrow} title={ABOUT.video.title} />
      <Sep />
      <Strip />
      <Sep />
      <Featured titled headline={ABOUT.products} />
      <Sep />
      <Features
        cls="pfeat--plain"
        items={MILESTONES.map((m) => ({ title: `${m.year} · ${m.title}`, text: m.text }))}
      />
      <Newsletter small />
    </>
  );
}
