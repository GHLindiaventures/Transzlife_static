/* ==========================================================
   SITE CONTENT
   All copy lives here, taken from the original TranzLife project
   (Tranz_life_dev: src/data/*.js and the page HTML).
   Edit this file to change text; components never hard-code copy.
   ========================================================== */

export const BRAND = {
  name: 'TranzLife Biosciences',
  wordmark: 'TranzLife',
  tagline: 'Innovating life beyond limits',
  creed: 'Rooted in Nature · Perfected by Science · Shaping Everyday Longevity',
  email: 'info@tranzlife.in',
  careEmail: 'care@tranzlife.in',
  phone: '+91 917 611 2188 / +91 44 1234 5678',
  address: 'Tranz Life Biosciences Pvt. Ltd., 6, Flat 2D, 2nd Floor, Queenscourt, Montieth Road, Egmore, Chennai - 600 008, Tamil Nadu, India.',
  hours: 'Mon – Sat: 9:00 AM – 7:00 PM IST',
  license: 'Manufacturing Lic. TN/AYU/24/1234',
  copyright: '© 2026 TranzLife Biosciences',
  disclaimer:
    'TranzLife products are plant-based wellness products and are not intended to diagnose, treat, cure or prevent any disease. Consult your doctor before use if you are pregnant, nursing or managing a health condition.',
};

/* Product photos live in /public/assets (product-N.jpg). `photo` = N. */
export const PRODUCTS = [
  {
    id: 'gummies',
    showcase: 'assets/products/showcase-gummies.jpg',
    compare: { kind: "cutout", before: { src: "illustrations/lungs-before.webp", label: "Before", sub: "Everyday pollutants", alt: "Illustration of discoloured lungs burdened by everyday pollutants" }, after: { src: "illustrations/lungs.webp", label: "After", sub: "Supported with Lung Booster", alt: "Illustration of healthy, clear lungs" } }, photo: 4, ingredients: ['Tulsi', 'Vasaka', 'Licorice Root', 'Sukku (Dry Ginger)', 'Thippili (Long Pepper)', 'Vitamin C, D3 & Zinc'], dosage: 'Follow the serving size on the pack; do not exceed the recommended daily intake', name: 'PulmoClear™ Lung Booster Gummies', short: 'PulmoClear™', tag: 'Lung Detox',
    price: 549, size: '60 Gummies',
    desc: 'Botanical-based wellness gummies combining traditional Ayurvedic herbs (Tulsi, Vasaka, Licorice, Dry Ginger, Long Pepper and more) with Vitamin C, D3 and Zinc, to support respiratory wellness and everyday health. Natural berry flavour, 60 gummies.',
    story: { title: 'Lung Detox', text: 'Tulsi, Vasaka, Licorice and 6 more Ayurvedic botanicals with Vitamin C, D3 & Zinc, in berry gummies for everyday respiratory wellness.', note: 'Breathe Freely · Live Fully' },
  },
  {
    id: 'liver',
    showcase: 'assets/products/showcase-liver.jpg',
    compare: { kind: "cutout", before: { src: "illustrations/liver-before.webp", label: "Before", sub: "Everyday strain", alt: "Illustration of a dull, mottled liver under everyday strain" }, after: { src: "illustrations/liver-botanical.webp", label: "After", sub: "Supported with Liver Booster", alt: "Illustration of a smooth, healthy liver" } }, photo: 5, ingredients: ['Bhumyamalaki 500mg', 'Kalmegh 400mg', 'Kutki 400mg', 'Punarnava 300mg', 'Bhringraj 300mg', 'Daruharidra 200mg'], dosage: 'Adults: 10 ml (2 tsp) twice daily after meals', name: 'Liver Booster (LiverDetox™) Polyherbal Concoction', short: 'LiverDetox™', tag: 'Liver Booster',
    price: 900, size: '500 ml Polyherbal Concoction',
    desc: '100% Ayurvedic polyherbal concoction of 11 traditional botanicals, including Bhumyamalaki, Kalmegh, Kutki, Punarnava and Daruharidra, designed to support normal liver function, digestive wellness and overall well-being. No added colours or sugar.',
    story: { title: 'Liver Booster', text: '500 ml polyherbal concoction of Bhumyamalaki, Kalmegh, Kutki & Punarnava to support normal liver function and digestive wellness.', note: 'Classical Ayurvedic Wisdom' },
  },
  {
    id: 'rollon',
    showcase: 'assets/products/showcase-rollon.jpg',
    compare: { kind: "scene", before: { src: "illustrations/cycle-before.webp", label: "Before", sub: "Uneasy days", alt: "Illustration of a young woman holding her stomach, looking uncomfortable" }, after: { src: "illustrations/cycle.webp", label: "After", sub: "With the CycleRelief ritual", alt: "Illustration of the same young woman smiling and relaxed" } }, photo: 1, ingredients: ['Wintergreen oil', 'Peppermint oil', 'Ginger essential oil', 'Lavender essential oil', 'Eucalyptus oil', 'Sesame oil'], dosage: 'Roll onto the lower abdomen, lower back or inner wrists and massage until absorbed; 2–4 times daily as needed', name: 'CycleRelief™ Menstrual Comfort Roll-On', short: 'CycleRelief™', tag: 'Period Relief',
    price: 299, size: '8 ml Roll-On',
    desc: 'Plant-based period comfort roll-on with Wintergreen, Peppermint, Ginger, Lavender and Eucalyptus oils in Sesame oil. A soothing, non-greasy massage for menstrual comfort, relaxation and well-being.',
    story: { title: 'Cycle Relief', text: 'Wintergreen, Peppermint, Ginger, Lavender and Eucalyptus oils for a soothing massage that supports menstrual comfort.', note: 'Nature’s Care Every Cycle' },
  },
  {
    id: 'reviva',
    showcase: 'assets/products/showcase-reviva.jpg',
    compare: { kind: "scene", before: { src: "illustrations/reviva-before.webp", label: "Before", sub: "A heavy start", alt: "A tired man sitting on the edge of his bed in dim morning light, rubbing his neck" }, after: { src: "illustrations/reviva.webp", label: "After", sub: "With the Reviva ritual", alt: "The same man refreshed and smiling in warm sunlight, holding a roll-on bottle" } }, photo: 3, ingredients: ['Dill essential oil', 'Eucalyptus essential oil', 'Massage roll-on', 'External use'], dosage: 'Roll gently around the belly button every morning on an empty stomach; use daily', name: 'Reviva™ Roll-On', short: 'Reviva™', tag: 'Botanical Massage Roll-On',
    price: 399, size: '50 ml Massage Roll-On',
    desc: 'Botanical massage roll-on for an everyday wellness and vitality ritual. A practical massage roll-on designed to complement a daily self-care routine with a refreshing topical application.',
    story: { title: 'Wellness & Vitality', text: 'Botanical massage roll-on with Dill and Eucalyptus essential oils, for an everyday wellness and vitality ritual.', note: 'Massage Roll-On · 50 ml' },
  },
  {
    id: 'energy',
    showcase: 'assets/products/showcase-energy.jpg',
    photo: 2, ingredients: ['Ruta graveolens (Q)', 'Hecla lava (3X)', 'Symphytum officinale (Q)', 'Calcarea phosphorica (8X)', 'Echinacea angustifolia (Q)'], dosage: '7.5 ml twice daily, or as advised by a healthcare professional', name: 'TranzLife Energy Booster™', short: 'Energy Booster™', tag: 'Energy & Vitality',
    price: 1850, size: '500 ml Oral Liquid',
    desc: 'Herbal and bioactive oral liquid formulation designed to complement an active lifestyle and support everyday energy, stamina, vitality and overall wellness.',
    story: { title: 'Energy & Vitality', text: 'An easy-to-measure oral liquid designed to support everyday energy and stamina as part of an active lifestyle.', note: 'Oral Liquid · 500 ml' },
  },
  {
    id: 'inhaler',
    showcase: 'assets/products/showcase-inhaler.jpg',
    compare: { kind: "scene", before: { src: "illustrations/inhaler-before.webp", label: "Before", sub: "The urge hits", alt: "A stressed man on a grey city terrace, hand on his forehead, holding a cigarette pack" }, after: { src: "illustrations/inhaler.webp", label: "After", sub: "With BreatheFree", alt: "The same man calm on a green, sunlit terrace, breathing in from a small white inhaler, the cigarette pack crushed and set aside" } }, photo: 6, ingredients: ['Peppermint Oil', 'Eucalyptus Oil', 'Lavender Oil', 'Lemon Oil', 'Black Pepper Oil', 'Tulsi Oil'], dosage: 'Remove the cap, place near each nostril and take slow, deep inhalations whenever cravings or stress hit', name: 'BreatheFree™ Aromatherapy Inhaler', short: 'BreatheFree™', tag: 'Quit Smoking',
    price: 249, size: 'Pocket Inhaler',
    desc: 'Essential oil-based, non-addictive aromatherapy inhaler to support your journey towards a smoke-free lifestyle. Peppermint, Eucalyptus, Lavender, Lemon, Black Pepper and Tulsi oils help manage cravings and stress, and promote relaxation and breathing comfort.',
    story: { title: 'BreatheFree', text: 'Peppermint, Eucalyptus, Lavender, Lemon, Black Pepper & Tulsi oils to help manage cravings and stress on the go.', note: 'Pocket Friendly · 100% Natural' },
  },
  {
    // Coming soon: no price yet, so cards show "Price to be announced" and an Explore link.
    // Showcase + product-7.png are made from the pack photo by scripts/gallery/build-showcase.mjs.
    id: 'drops',
    showcase: 'assets/products/showcase-drops.jpg',
    photo: 7, ingredients: ['Peppermint', 'Pudina (Indian Mint)', 'Tulsi', 'Ginger', 'Spearmint', 'MCT (coconut-derived)', 'Stevia'], dosage: '10–15 drops (about 0.5 ml) under the tongue or in a little water, 1–2 times daily', name: 'BreathFree™ Respiratory Wellness Drops', short: 'BreathFree™ Drops', tag: 'Coming Soon',
    price: null, size: '30 ml Drops',
    desc: 'Respiratory wellness drops with natural botanical actives (Peppermint, Pudina, Tulsi, Ginger and Spearmint) for a refreshing, cooling and soothing breathing experience. Vegetarian, caffeine free and gluten free.',
    story: { title: 'BreathFree Drops', text: 'Peppermint, Pudina, Tulsi & Ginger drops for a refreshing, cooling respiratory experience.', note: 'Liquid Drops · 30 ml' },
  },
];

/* Product pages live in the store section (/products/<store id>, copied from the store project). */
export const STORE_ID = {
  gummies: 'pulmoclear-gummies',
  energy: 'energy-booster',
  rollon: 'cyclerelief-roll-on',
  reviva: 'reviva-roll-on',
  liver: 'liver-booster',
  inhaler: 'breathefree-inhaler',
  drops: 'breathfree-drops',
};
export const productUrl = (id) => (STORE_ID[id] ? `/products/${STORE_ID[id]}` : '/shop');

/** A real selling price: null, undefined, '' , 0 and negatives all mean "not priced yet", never ₹0. */
export const hasPrice = (p) => Number.isFinite(p?.price) && p.price > 0;
export const priceLabel = (p) => (hasPrice(p) ? `₹${p.price}` : 'Price to be announced');

/* Card pricing: `price` is what the customer pays; `mrp` is the printed MRP (defaults to the price).
   A struck-out MRP and "% off" only show when the price is actually below the MRP: never sell
   above, or advertise an MRP higher than, the one printed on the pack. */
export const mrpOf = (p) => (!hasPrice(p) ? null : Math.max(p.mrp > 0 ? p.mrp : p.price, p.price));
export const offOf = (p) => {
  const mrp = mrpOf(p);
  return mrp && mrp > p.price ? Math.round((1 - p.price / mrp) * 100) : 0;
};

export const ANNOUNCEMENTS = [
  'Free delivery on orders over ₹999',
  'Government Recognized & Certified',
  'Live naturally. Live healthier.',
];

export const NAV_COLLECTIONS = PRODUCTS.map((p) => p.short);

/* ---------------- home ---------------- */
export const HERO = [
  { image: 'hero/hero-1.webp', tone: 'light', bg: 'linear-gradient(to bottom, #162115 0%, #212b20 55%, #494f47 100%)', alt: 'PulmoClear Gummies and LiverDetox bottles on a stone podium with fresh herbs', eyebrow: 'TranzLife Biosciences', title: 'Live naturally. Live healthier.', sub: 'Ayurvedic, plant-based wellness formulations, made in Chennai, India.', cta: 'Shop all products', to: '/shop' },
  { image: 'hero/hero-2.webp', tone: 'ink', bg: 'linear-gradient(to bottom, #d3bba1 0%, #d9bea2 55%, #e5c9aa 100%)', alt: 'Reviva roll-on and BreatheFree inhaler on a stone block with eucalyptus leaves', eyebrow: 'Our vision', title: 'From the roots of nature to the infinity of science', sub: 'TranzLife is shaping the future of life.', cta: 'Our story', to: '/about' },
  { image: 'hero/hero-3.webp', tone: 'ink', bg: 'linear-gradient(to bottom, #9ca17f 0%, #aaad92 55%, #b8b6ab 100%)', alt: 'CycleRelief roll-on and Energy Booster bottle on a marble podium with lavender', eyebrow: 'Ayurvedic wisdom', title: 'Rooted in nature. Perfected by science.', sub: 'Classical botanicals, standardised and quality-tested.', cta: 'Explore the science', to: '/science' },
];

/* The first thing a visitor reads under the hero: a single headline that leads into the products. */
export const RICH = {
  title: 'Plant-based wellness, built on science.',
};

export const PRODUCTS_SECTION = {
  id: 'products',
  headline: 'Our products',
  sub: 'Find the formulation for your need.',
};

export const PRODUCTS_PAGE = {
  headline: 'All products',
  sub: 'Every TranzLife formulation, in one place.',
};

export const BANNER = { words: ['Nature meets science', 'Rooted in Ayurveda'], cta: 'Discover our science', to: '/science' };

export const COMPARE_INTRO = {
  eyebrow: 'What each formula is designed to support',
  title: 'Targeted Botanical Formulations',
  note: 'Standardized Ayurvedic extracts & bioactive botanicals. Individual experience varies.',
};

export const BENEFITS = {
  headline: 'Why TranzLife',
  subtitle: 'The TranzLife Difference',
  lead: 'A thoughtful blend of nature, science and quality — creating trusted wellness solutions for everyday life.',
  items: [
    { title: 'Innovate', text: 'Research-driven formulations with a focus on efficacy and safety.' },
    { title: 'Develop', text: 'Advanced R&D and modern technology to create superior products.' },
    { title: 'Deliver', text: 'High-quality manufacturing and stringent quality standards.' },
    { title: 'Impact', text: 'Empowering healthier lives while promoting sustainability and ethical practices.' },
    { title: 'Rooted in Ayurveda', text: 'Classical wisdom from the Charaka Samhita and Sushruta Samhita, standardized for today.' },
    { title: 'GMP certified', text: 'Made in certified Class 10,000 (ISO 7) cleanrooms under AYUSH GMP and ISO 9001:2015.' },
  ],
};

export const REELS = { headline: 'Which one is yours?' };

export const STRIP = ['100% Indigenous', 'Nutraceutical Safety', 'DPIIT Recognized', 'Registered Biotech', 'GeM Govt. Verified'];

export const STORY_BLOCK = {
  eyebrow: 'Our story',
  title: 'Ayurvedic wisdom, modern quality',
  link: { label: 'Read the full story', to: '/about' },
  paragraphs: [
    'Born in Chennai, TranzLife Biosciences brings together the wisdom of Ayurveda and modern science to create natural, safe and effective solutions that support health and well-being.',
    'We carefully select quality botanicals and check their purity before they enter our formulation process.',
    'Every product is quality-tested at every step.',
  ],
};

export const SCENES = [
  { title: 'TranzLife is shaping the future of life', text: '100% Ayurvedic Roots · Bio-Active Molecular Science · Clinical Innovation' },
  {
    title: 'Ayurvedic wisdom',
    text: 'Health in Ayurveda means the body is free of toxins; the mind is at peace, the emotions are calm and happy, wastes are efficiently eliminated, the organs function normally and the immune system is strong.',
  },
  {
    title: 'Technology collaboration with NRDC',
    text: 'TranzLife Biosciences has entered into a technology collaboration with the National Research Development Corporation (NRDC), Ministry of Science and Technology, Government of India.',
  },
];

/* Registration and recognition badges (files in /public/assets/badges, also shown on the About page). */
export const BRANDS = {
  headline: 'Government Recognized & Certified',
  badges: [
    { src: 'fssai.png', alt: 'FSSAI' },
    { src: 'ayush.png', alt: 'Ministry of AYUSH' },
    { src: 'make-in-india.png', alt: 'Make in India' },
    { src: 'dpiit-startup-india.png', alt: 'DPIIT Startup India' },
    { src: 'msme.png', alt: 'MSME' },
    { src: 'gem-gov.png', alt: 'GeM, Government e-Marketplace' },
  ],
};

export const BGVIDEO = { photo: 'gmp-lab', eyebrow: 'Quality & manufacturing', title: 'Made in ISO 7 cleanrooms under AYUSH GMP' };

export const NEWSLETTER = {
  title: 'Live naturally. Live healthier.',
  text: 'Rooted in Nature · Perfected by Science',
  email: 'Email address',
  button: 'Subscribe',
};

/* Closing call to action on the home page. */
export const HELP_CTA = {
  eyebrow: 'Have questions?',
  title: 'Talk to Our',
  titleEm: 'Wellness Team',
  text: 'Get personalised guidance on our products, ingredients and the right choice for your daily wellness routine.',
  primary: { label: 'Contact Us', to: '/contact' },
  secondary: { label: 'Explore FAQs', to: '/faq' },
  features: ['Ask Your Questions', 'Get Expert Advice', 'Learn & Choose'],
};

/* ---------------- about ---------------- */
export const ABOUT = {
  banner: 'About Us',
  intro: {
    title: 'From the roots of nature to the infinity of science',
    text: 'Born in Chennai, TranzLife Biosciences brings together the wisdom of Ayurveda and modern science to create natural, safe and effective solutions that support health and well-being.',
  },
  rows: [
    { photo: 'ayurveda', title: 'Rooted in 5,000 years of Ayurvedic wisdom', text: 'For thousands of years, classical Ayurvedic texts such as the Charaka Samhita and Sushruta Samhita have documented plants that support health and vitality. TranzLife was founded to bridge the gap between sacred plants and modern formulation science.' },
    { photo: 'lab-microscope', title: 'Where molecular science unlocks bioavailability', text: 'We do not simply grind herbs into capsules. We isolate, standardize and protect the active phytochemical keys that make nature heal, and deliver them in modern formats: inhalers, roll-ons, gummies and polyherbal concoctions.' },
    { photo: 'lotus', title: 'Recognized by the nation, welcomed by the world', text: 'Our work is shaped through collaboration with government institutions and engagement with international partners.' },
  ],
  video: { photo: 'green-leaves', eyebrow: 'National technology collaboration', title: 'Technology collaboration with NRDC' },
  products: 'Our products',
  pillars: BENEFITS.items.slice(0, 4),
};

export const MILESTONES = [
  { year: '2021', title: 'Botanical Heritage & Inception', text: 'TranzLife Biosciences founded in Chennai to bring together classical Ayurvedic wisdom and modern scientific validation.' },
  { year: '2022', title: 'Extraction & Standardization Protocols', text: 'Pioneered clean, solvent-free botanical extraction and quality testing standards.' },
  { year: '2023', title: 'NRDC Technology Collaboration', text: 'Technology collaboration with the National Research Development Corporation (NRDC), Govt. of India.' },
  { year: '2024', title: 'Novel Delivery Formats Portfolio', text: 'A modern multi-format line: pocket aromatherapy inhalers, roll-ons, gummies and polyherbal concoctions.' },
];

/* ---------------- science ---------------- */
export const SCIENCE = {
  banner: 'Science & Innovation',
  intro: { title: 'Where plant intelligence meets precision molecular science' },
  stats: [
    { title: '+320% uptake', text: 'Bioavailability elevation' },
    { title: '600+ assays', text: 'Phytochemical screenings' },
    { title: '98.4% purity', text: 'Active standardization' },
    { title: '0.00% synthetic', text: 'Zero chemical solvents' },
  ],
  note: {
    title: 'Solving the botanical absorption bottleneck',
    text: 'Raw botanicals show poor human bioavailability. TranzLife’s multi-tier platform is built to overcome these barriers.',
  },
  pillars: [
    { photo: 'green-leaves', title: 'Supercritical CO₂ fluid extraction', text: 'At 31.1°C and above 73.8 bar, carbon dioxide penetrates plant cells like a gas and dissolves active lipids like a solvent, leaving zero chemical residue.' },
    { photo: 'lab-research', title: 'Phytosome & liposomal bi-layers', text: 'Active polyphenols are bonded to non-GMO sunflower phosphatidylcholine, a lipid envelope that shields fragile molecules through the stomach.' },
    { photo: 'lab-microscope', title: 'HPLC quantitative standardization', text: 'High-performance liquid chromatography fingerprints and quantifies exact active fractions in every batch, for consistent dosing.' },
    { photo: 'ayurveda-ingredients', title: 'Entourage bio-architectures', text: 'Multi-terpene botanical architectures where secondary plant flavonoids protect primary active ligands and prolong plasma half-life.' },
    { photo: 'turmeric-dried', title: 'TranzLife bio-phytosome delivery platform', text: 'Actives are complexed within phosphatidylcholine bi-layers: resistant to gastric acid and designed for rapid cellular delivery.' },
  ],
  cta: { title: 'Interactive 3D compound explorer', text: 'Rotate and explore the atomic geometry of our active botanical compounds.', button: 'Explore' },
  video: { photo: 'lab-microscope', eyebrow: 'The cellular delivery platform', title: 'Plant intelligence, precision science' },
};

/* ---------------- faq ---------------- */
export const FAQ = {
  banner: 'Frequently Asked Questions',
  categories: [
    { id: 'all', label: 'All Questions' },
    { id: 'safety', label: 'Safety & Usage' },
    { id: 'quality', label: 'Quality & Cleanroom' },
    { id: 'orders', label: 'Orders & Shipping' },
  ],
  items: [
    { cat: 'safety', q: 'Can I take TranzLife formulations alongside prescription medications?', a: 'Always consult your prescribing physician before combining any herbal supplements with ongoing allopathic treatments. As a standard clinical guideline, maintain a separation interval of 60 to 90 minutes between herbal supplements and prescription drugs to prevent potential metabolic absorption interference.' },
    { cat: 'safety', q: 'Can I take PulmoClear gummies if I have diabetes?', a: 'PulmoClear gummies are pectin-based and formulated with low-glycemic natural fruit extracts rather than high-fructose corn syrups. However, individuals managing diabetes should review the detailed nutritional carbohydrate panel and consult their diabetologist.' },
    { cat: 'safety', q: 'Are TranzLife formulations safe during pregnancy or nursing?', a: 'As a conservative safety precaution, pregnant women and lactating mothers should refrain from starting active botanical detox formulations (such as PulmoClear or LiverDetox) without explicit prior authorization from their obstetrician or healthcare provider.' },
    { cat: 'quality', q: 'Where are TranzLife formulations manufactured?', a: 'All TranzLife products are manufactured inside certified Class 10,000 (ISO 7) cleanroom facilities in Tamil Nadu, India adhering strictly to AYUSH GMP, ISO 9001:2015, and pharmaceutical-grade validation protocols.' },
    { cat: 'quality', q: 'How do you verify heavy metal and pesticide safety?', a: 'Every production lot undergoes independent NABL-accredited third-party laboratory testing via Inductively Coupled Plasma Mass Spectrometry (ICP-MS) to screen for lead, arsenic, cadmium, mercury, and 140+ pesticides adhering to strict USP <2232> limits before market release.' },
    { cat: 'quality', q: 'What extraction methods do you use?', a: 'We utilize closed-loop supercritical CO₂ thermodynamic extraction and cryogenic milling. This completely eliminates toxic petrochemical solvents like hexane, benzene, and acetone, preserving delicate thermolabile enzymes in their natural state.' },
    { cat: 'orders', q: 'What is your domestic shipping delivery timeframe?', a: 'Orders placed before 2:00 PM IST are dispatched on the same day. Delivery typically takes 2 to 4 business days across Indian metropolitan centers and 3 to 7 days for regional destinations. We offer complimentary insured shipping on all orders over ₹999.' },
    { cat: 'orders', q: 'What is your replacement and return policy?', a: 'If your order arrives damaged, leaking, or defective, contact our customer care team within 48 hours of delivery with packaging photos for an immediate replacement or full refund. Unopened products in their original tamper-evident packaging can be returned within 7 days.' },
    { cat: 'orders', q: 'Can I customize corporate wellness gifting packages?', a: 'Yes. Our corporate wellness team curates bespoke executive wellness suites in branded biodegradable presentation boxes with custom corporate letterpress notes. Contact us through our enquiry form or via WhatsApp.' },
  ],
};

/* ---------------- contact ---------------- */
export const CONTACT = {
  eyebrow: 'Get in touch',
  title: ['Contact', 'TranzLife Biosciences'],
  text: 'Questions about a product, an order, bulk supply or a partnership? Our wellness team is here to help you every step of the way.',
  form: {
    title: 'Send us an enquiry',
    text: 'Fill in your details and our team will get back to you by your preferred method.',
    topics: ['Product enquiry', 'Order & delivery', 'Bulk / corporate order', 'Distributor / retail partnership', 'Research collaboration', 'Feedback', 'General enquiry'],
    methods: ['Phone', 'Email', 'WhatsApp'],
    consent: 'I agree to the Privacy Policy and consent to being contacted.',
    send: 'Send enquiry',
  },
  offices: [
    { title: 'Chennai (Head Office)', text: 'Tranz Life Biosciences Pvt. Ltd., 6, Flat 2D, 2nd Floor, Queenscourt, Montieth Road, Egmore, Chennai – 600 008, Tamil Nadu, India' },
  ],
  phones: ['+91 917 611 2188'],
  whatsapp: '919176112188', // number for wa.me links, digits only with country code
  emails: [
    { label: 'General enquiries', value: BRAND.email },
    { label: 'Customer care', value: BRAND.careEmail },
  ],
  hours: ['Mon – Sat: 9:00 AM – 7:00 PM IST', 'Sunday: Closed'],
  mapQuery: 'Queenscourt, Montieth Road, Egmore, Chennai 600008',
  faqTitle: 'Frequently Asked Questions',
  faqs: [
    { q: 'How do I place an order?', a: 'Shop online from our Shop page and check out securely, or send us an enquiry on this page and our team will help you place the order by phone or WhatsApp.' },
    { q: 'Do you deliver across India?', a: 'Yes. We ship across India. Orders are usually dispatched within 1–2 working days and delivered in 3–7 working days, depending on your location.' },
    { q: 'What if my order arrives damaged?', a: 'Contact us within 48 hours of delivery with photos of the package and the product, and we will arrange a replacement or a refund.' },
    { q: 'Can I order in bulk or become a distributor?', a: 'Yes. Choose “Bulk / corporate order” or “Distributor / retail partnership” in the enquiry form and our team will share pricing and next steps.' },
    { q: 'Can you tell me which product is right for me?', a: 'Our team can explain what each product contains and how it is used. For medical conditions, pregnancy or ongoing medication, please consult your doctor before use.' },
  ],
  whatsappStrip: 'Have questions? Chat with us on WhatsApp',
};

/* ---------------- footer ---------------- */
/* Footer links. Only pages that exist are linked (Ingredients, Sustainability, Privacy and Terms
   come back here once those pages are built). */
export const FOOTER = {
  products: { title: 'Products', links: PRODUCTS.map((p) => ({ label: p.short, to: productUrl(p.id) })) },
  company: {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Science & Innovation', to: '/science' },
      { label: 'Sustainability', to: '/sustainability' },
      { label: 'Quality & Manufacturing', to: '/science#sc-pipeline' },
      { label: 'Certifications', to: '/science#sc-certs' },
      { label: 'Privacy Policy', to: '/policies/privacy' },
      { label: 'Terms & Conditions', to: '/policies/terms' },
      { label: 'Shipping & Returns', to: '/policies/shipping' },
    ],
  },
  help: {
    title: 'Help',
    links: [
      { label: 'Contact Us', to: '/contact' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Retail partners', to: '/contact' },
      { label: 'Corporate gifting', to: '/contact' },
    ],
  },
  about: { title: 'About TranzLife' },
  tagline: 'Live naturally. Live healthier.',
  blurb: 'Ayurvedic, plant-based solutions for everyday wellness and good health.',
  motto: ['Wellness', 'Innovation', 'A Healthier Tomorrow'],
  legal: [
    { label: 'Privacy policy', to: '/policies/privacy' },
    { label: 'Terms of use', to: '/policies/terms' },
    { label: 'Shipping & returns', to: '/policies/shipping' },
  ],
};

/* Social profiles: add the real URLs to show the icons in the footer (empty = hidden). */
export const SOCIAL_LINKS = { Facebook: '', X: '', Instagram: '', YouTube: '' };

/* ---------------- photography ----------------
   Files in /public/assets/photos, all public domain or CC0 (sources and licences: see CREDITS.md). */
export const PHOTOS = {
  banner: 'green-canopy',
  benefits: 'ayurveda-ingredients',
  iwt: 'wellness-journey',
  parallax: 'forest-leaves',
  parallaxSide: ['lotus', 'ayurveda-ingredients'],
  exploreCircle: 'explore-circle',
  aboutBanner: 'lavender',
  scienceBanner: 'lab-research',
  faqBanner: 'faq-banner',
  contactBanner: 'contact-banner',
  contactSide: 'holy-basil',
};

export const PHOTO_EXT = { 'ayurveda-ingredients': 'png', 'ayurveda-banyan': 'webp', 'wellness-journey': 'webp', 'gmp-lab': 'webp' }; // photos that are not .jpg

export const PHOTO_ALT = {
  ayurveda: 'Jars of powdered and dried Ayurvedic herbs being scooped with wooden spoons',
  'green-leaves': 'Fresh green leaves in soft light',
  'green-canopy': 'Aerial view of a dense green forest canopy',
  'ayurveda-banyan': 'Ayurvedic herbs, turmeric, amla, neem and a stone mortar on slate under an ancient banyan tree',
  'wellness-journey': 'A complete wellness journey for everyday life: six TranzLife formulations for breath, liver, women’s comfort, metabolic wellness, calm and balance',
  'gmp-lab': 'A technician in a white coat, mask and hairnet holds up a flask of golden herbal extract in a clean laboratory, with fresh herbs and a mortar on the bench',
  'forest-leaves': 'Green leaves in a forest',
  'lab-microscope': 'Researcher working with a microscope in a laboratory',
  'lab-research': 'Scientist in safety glasses examining coloured samples in a lab',
  lavender: 'Lavender field in bloom',
  lotus: 'TranzLife customer support and office desk',
  'contact-banner': 'TranzLife customer support and office desk',
  'ayurveda-ingredients': 'Tulsi leaves, ginger, cardamom, cloves and cinnamon arranged in the shape of a mortar',
  'faq-banner': 'Frequently Asked Questions and customer support',
  dill: 'Frequently Asked Questions and customer support',
  'spices-grid': 'Authentic Ayurvedic herbs, seeds and spices arranged in circular wooden bowls',
  'basil-closeup': 'Fresh mint leaves',
  'explore-circle': 'Botanical crystal geometry cube with lush green foliage',
  'holy-basil': 'Holy basil (tulsi) plant',
  'turmeric-dried': 'Hand holding dried turmeric roots over a pile of turmeric',
};

/* ---------------- product pages ---------------- */
export const getProduct = (id) => PRODUCTS.find((p) => p.id === id);

/**
 * "Conceptual illustration" showcase on a product page: the product on the left, a nature-inspired
 * illustration of what it is built from on the right. Only products listed here get the section.
 */
export const SHOWCASE = {
  liver: {
    eyebrow: 'Liver Booster · LiverDetox',
    title: ['Designed to support a', 'cleaner, healthier liver'],
    intro: 'Drag the slider to explore. On the left, the formulation; on the right, a visual guide to what this 100% Ayurvedic polyherbal concoction is designed to support: it detoxifies, protects and rejuvenates.',
    left: { label: 'The product', sub: 'LiverDetox™ · 500 ml', tags: ['100% Ayurvedic', 'Polyherbal formula', 'Eleven classical herbs'] },
    right: {
      label: 'The inspiration',
      sub: 'Classical botanicals',
      image: 'illustrations/liver-botanical.webp',
      alt: 'Illustration of a smooth, healthy liver surrounded by classical Ayurvedic leaves',
      tags: ['Natural detox support', 'Antioxidant protection', 'Digestion & vitality'],
    },
    concept: 'Conceptual illustration',
    benefits: [
      ['Supports liver detoxification', 'Helps flush out toxins and supports natural cleansing.', 'drop'],
      ['Promotes liver health', 'Protects liver cells and supports healthy liver function.', 'shield'],
      ['Powerful antioxidant', 'Rich in natural antioxidants that combat oxidative stress.', 'spark'],
      ['Improves digestion', 'Supports digestion and nutrient absorption.', 'cycle'],
      ['Enhances vitality', 'Helps improve energy, immunity and overall well-being.', 'bolt'],
    ],
    botanicalsTitle: 'Each 10 ml contains 11 classical botanicals',
    botanicals: [
      ['Bhumyamalaki', '500 mg'], ['Kalmegh', '400 mg'], ['Kutki', '400 mg'], ['Punarnava', '300 mg'],
      ['Bhringraj', '300 mg'], ['Daruharidra', '200 mg'], ['Guduchi', '200 mg'], ['Amla', '200 mg'],
      ['Haritaki', '200 mg'], ['Turmeric', '150 mg'], ['Black Pepper', '50 mg'],
    ],
    note: 'Illustrative only: these images show what Liver Booster is designed to support. They are not clinical before-and-after results, and individual experience varies. Liver Booster is an Ayurvedic proprietary medicine and is not intended to diagnose, treat, cure or prevent any disease. Not recommended for pregnant or lactating women; consult your physician if you are under medication.',
  },
};

export const NAV_PRODUCTS = PRODUCTS.map((p) => ({ id: p.id, name: p.short }));
