// Per-product copy for the product-page gallery slides.
// Wellness-support language only (same rules as src/store/data/products.js): no cure / treatment claims.
// `icon` names are lucide-react icon exports.
// `illustration`: an organ cutout on white (blended into the slide) or, with `illustrationPhoto: true`,
// a scene photo (shown in a framed card).

export const SLIDE_COPY = {
  'pulmoclear-gummies': {
    photo: 'assets/products/showcase-pulmoclear-v2.jpg',
    illustration: 'assets/illustrations/lungs.webp',
    helps: [
      ['Wind', 'Supports respiratory wellness'],
      ['Sparkles', 'Provides antioxidant support'],
      ['ShieldCheck', 'Supports natural immune function'],
      ['Leaf', 'Ayurvedic botanicals with Vitamin C, D3 & Zinc'],
      ['Candy', 'Convenient daily berry-flavour gummy'],
    ],
    pill: '9 botanicals + 3 micronutrients',
    madeForTitle: 'Care for your lungs, every day',
  },
  'liver-booster': {
    photo: 'assets/products/showcase-liver-v2.jpg',
    card: true, // the pack photo is a lifestyle scene: shown in a framed card
    illustration: 'assets/illustrations/liver-botanical.webp',
    helps: [
      ['HeartPulse', 'Supports normal liver function'],
      ['Sparkles', 'Provides antioxidant support'],
      ['Activity', 'Supports natural metabolic processes'],
      ['Soup', 'Supports digestive health and appetite'],
      ['Sprout', 'A blend of traditional botanical ingredients'],
    ],
    pill: '11 Ayurvedic botanicals per 10 ml',
    madeForTitle: 'Your liver works hard. Care for it daily.',
  },
  'cyclerelief-roll-on': {
    photo: 'assets/products/showcase-rollon.jpg',
    card: true, // pack shot is on a grey studio background
    illustration: 'assets/illustrations/cycle.webp',
    illustrationPhoto: true,
    helps: [
      ['Flower2', 'Supports menstrual comfort routines'],
      ['HandHeart', 'A soothing topical application'],
      ['Smile', 'Supports relaxation and personal comfort'],
      ['Feather', 'Easy-to-apply, non-greasy format'],
      ['Briefcase', 'Compact 8 ml roll-on, easy to carry'],
    ],
    pill: '6 plant-based oils',
    madeForTitle: 'Comfort for every cycle',
  },
  'reviva-roll-on': {
    photo: 'assets/products/showcase-reviva-v2.jpg',
    card: true, // white pack on white: shows the lifestyle photo instead
    illustration: 'assets/illustrations/reviva.webp',
    illustrationPhoto: true,
    helps: [
      ['Sun', 'A refreshing topical application'],
      ['Timer', 'Supports a daily self-care routine'],
      ['HandHeart', 'A convenient massage application'],
      ['Leaf', 'Dill and Eucalyptus essential oils'],
      ['Briefcase', 'Portable, travel-friendly 50 ml'],
    ],
    pill: 'Dill + Eucalyptus essential oils',
    madeForTitle: 'A daily ritual for your blood-sugar routine',
  },
  'energy-booster': {
    photo: 'assets/products/showcase-energy.jpg',
    illustration: null,
    helps: [
      ['Zap', 'Supports everyday energy and stamina'],
      ['Sun', 'Promotes overall vitality and well-being'],
      ['Activity', 'Supports hormonal wellness'],
      ['ShieldCheck', 'Supports healthy immune function'],
      ['Footprints', 'Complements an active lifestyle'],
    ],
    pill: '5 botanical & mineral actives',
    madeForTitle: 'For days that ask for more',
  },
  'breathefree-inhaler': {
    photo: 'assets/products/showcase-breathefree-v2.jpg',
    card: true, // white pack on white: shows the lifestyle photo instead
    illustration: 'assets/illustrations/inhaler.webp',
    illustrationPhoto: true,
    helps: [
      ['CigaretteOff', 'Helps manage smoking cravings'],
      ['Smile', 'Promotes relaxation and emotional balance'],
      ['Wind', 'Supports a refreshing breathing experience'],
      ['Brain', 'Helps manage stress and irritability'],
      ['ShieldCheck', 'Non-addictive formulation'],
    ],
    pill: '6 essential oils incl. Lemon & Tulsi',
    madeForTitle: 'Breathe in. Slow down.',
  },
};

// BreathFree Drops: pack shot only (no lifestyle photo yet), so the gallery leads with the pack shot.
SLIDE_COPY['breathfree-drops'] = {
  photo: null,
  illustration: 'assets/illustrations/lungs.webp',
  helps: [
    ['Wind', 'Supports clear breathing'],
    ['HeartPulse', 'Promotes respiratory comfort'],
    ['Leaf', 'A refreshing mint sensation'],
    ['Snowflake', 'A soothing, cooling respiratory experience'],
    ['Zap', 'Helps you feel refreshed and active'],
  ],
  pill: 'Caffeine free · Gluten free · Vegetarian',
  madeForTitle: 'Breathe easy, feel refreshed',
};
