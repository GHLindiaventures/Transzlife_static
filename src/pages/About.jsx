import Featured from '../components/sections/Featured.jsx';
import { Sep, PageBanner, Intro, Row, BgVideo, Strip, Features, Newsletter } from '../components/sections/Blocks.jsx';

export default function About() {
  return (
    <>
      <PageBanner variant="about" />
      <Intro />
      <Sep />
      <Row />
      <Row reverse />
      <Row mod="short" />
      <Sep />
      <BgVideo small />
      <Sep />
      <Strip />
      <Sep />
      <Featured titled />
      <Sep />
      <Features cls="pfeat--plain" />
      <Newsletter small />
    </>
  );
}
