import { lazy, Suspense } from 'react';
import Hero from '../components/sections/Hero.jsx';
import Featured from '../components/sections/Featured.jsx';
import ProductSlider from '../components/sections/ProductSlider.jsx';
import { Sep, Rich, Banner, Benefits, Strip, ImageWithText, Brands, BgVideo, HelpCta } from '../components/sections/Blocks.jsx';
import { useSiteContent } from '../store/lib/siteContent.js';
import { usePageMeta } from '../lib/pageMeta.js';

const HomeReviews = lazy(() => import('../components/sections/HomeReviews.jsx'));

/*
 * Home: who we are -> what we make -> why trust us -> recognition -> how to get help -> customer reviews.
 * The hero always comes first; the order, visibility, headings and products of the other sections are
 * set in the dashboard (Website content > Homepage). Until that loads, the built-in order below shows.
 * "Our story" (image + text) is kept but hidden by default; staff can switch it back on.
 * Reels and Testimonials are left out until real videos are available.
 */
const DEFAULT = ['rich', 'products', 'sep', 'banner', 'benefits', 'formulations', 'strip', 'story', 'video', 'brands', 'help', 'reviews']
  .map((key) => ({ key, visible: key !== 'story' }));

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
    case 'reviews': return <Suspense fallback={null}><HomeReviews /></Suspense>;
    default: return null;
  }
}

export default function Home() {
  usePageMeta(null);   // the site defaults from index.html
  const content = useSiteContent();
  const sections = content?.home?.sections?.length ? content.home.sections : DEFAULT;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.tranzlife.in';
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TranzLife Biosciences',
      url: origin,
      logo: `${origin}/assets/logo.png`,
      contactPoint: { '@type': 'ContactPoint', telephone: '+91-91503-94443', contactType: 'customer service', areaServed: 'IN' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TranzLife Biosciences',
      url: origin,
      potentialAction: { '@type': 'SearchAction', target: `${origin}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <Hero />
      {sections.filter((s) => s.visible).map((s) => <Section key={s.key} s={s} />)}
    </>
  );
}
