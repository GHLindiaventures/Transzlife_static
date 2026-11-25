import Hero from '../components/sections/Hero.jsx';
import Featured from '../components/sections/Featured.jsx';
import ProductSlider from '../components/sections/ProductSlider.jsx';
import { Sep, Rich, Banner, Benefits, Strip, ImageWithText, Brands, BgVideo, HelpCta } from '../components/sections/Blocks.jsx';
import { useSiteContent } from '../store/lib/siteContent.js';

/*
 * Home: who we are -> what we make -> why trust us -> our story -> recognition -> how to get help.
 * The hero always comes first; the order, visibility, headings and products of the other sections are
 * set in the dashboard (Website content > Homepage). Until that loads, the built-in order below shows.
 * Reels and Testimonials are left out until real videos and customer reviews are available.
 */
const DEFAULT = ['rich', 'products', 'sep', 'banner', 'benefits', 'formulations', 'strip', 'story', 'video', 'brands', 'help'].map((key) => ({ key, visible: true }));

function Section({ s }) {
  switch (s.key) {
    case 'rich': return <Rich />;
    // key: a different product list starts the slider fresh (its timers and measurements depend on the count)
    case 'products': return <Featured key={(s.productIds || []).join()} {...(s.title ? { headline: s.title } : {})} {...(s.subtitle != null ? { sub: s.subtitle } : {})} productIds={s.productIds} />;
    case 'sep': return <Sep />;
    case 'banner': return <Banner />;
    case 'benefits': return <Benefits />;
    case 'formulations': return <ProductSlider key={(s.productIds || []).join()} productIds={s.productIds} />;
    case 'strip': return <Strip />;
    case 'story': return <ImageWithText />;
    case 'video': return <BgVideo />;
    case 'brands': return <Brands />;
    case 'help': return <HelpCta />;
    default: return null;
  }
}

export default function Home() {
  const content = useSiteContent();
  const sections = content?.home?.sections?.length ? content.home.sections : DEFAULT;
  return (
    <>
      <Hero />
      {sections.filter((s) => s.visible).map((s) => <Section key={s.key} s={s} />)}
    </>
  );
}
