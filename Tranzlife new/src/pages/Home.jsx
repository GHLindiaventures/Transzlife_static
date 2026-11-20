import Hero from '../components/sections/Hero.jsx';
import Featured from '../components/sections/Featured.jsx';
import ProductSlider from '../components/sections/ProductSlider.jsx';
import Reels from '../components/sections/Reels.jsx';
import Parallax from '../components/sections/Parallax.jsx';
import Testimonials from '../components/sections/Testimonials.jsx';
import { Sep, Rich, Banner, Benefits, Strip, ImageWithText, Brands, BgVideo, Newsletter } from '../components/sections/Blocks.jsx';

export default function Home() {
  return (
    <>
      <Hero />
      <Rich />
      <Featured />
      <Sep />
      <Banner />
      <Sep />
      <Benefits />
      <ProductSlider />
      <Sep />
      <Reels />
      <Strip />
      <Sep />
      <ImageWithText />
      <Sep />
      <Parallax />
      <Brands />
      <Sep />
      <Sep gap />
      <BgVideo />
      <Sep />
      <Testimonials />
      <Sep />
      <Newsletter />
    </>
  );
}
