import Hero from '../components/sections/Hero.jsx';
import Featured from '../components/sections/Featured.jsx';
import ProductSlider from '../components/sections/ProductSlider.jsx';
import { Sep, Rich, Banner, Benefits, Strip, ImageWithText, Brands, BgVideo, HelpCta } from '../components/sections/Blocks.jsx';

/*
 * Home: who we are -> what we make -> why trust us -> our story -> recognition -> how to get help.
 * Reels and Testimonials are left out until real videos and customer reviews are available
 * (the components are kept in components/sections).
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Rich />
      <Featured />
      <Sep />
      <Banner />
      <Benefits />
      <ProductSlider />
      <Strip />
      <ImageWithText />
      <BgVideo />
      <Brands />
      <HelpCta />
    </>
  );
}
