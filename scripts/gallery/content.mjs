// Per-product copy for the product-page gallery slides.
// Wellness-support language only (same rules as src/store/data/products.js): no cure / treatment claims.
// `icon` names are lucide-react icon exports.
// `illustration`: an organ cutout on white (blended into the slide) or, with `illustrationPhoto: true`,
// a scene photo (shown in a framed card).

export const SLIDE_COPY = {
  'pulmoclear-gummies': {
    photo: 'assets/products/showcase-gummies.jpg',
    illustration: 'assets/illustrations/lungs.webp',
    helps: [
      ['Wind', 'Everyday respiratory wellness'],
      ['Leaf', 'Throat & chest comfort with Tulsi, Vasaka & Mulethi'],
      ['ShieldCheck', 'Immunity support with Vitamin C, D3 & Zinc'],
      ['CigaretteOff', 'Daily care while you cut down on smoking'],
      ['Candy', 'Tasty berry gummy, no pills to swallow'],
    ],
    pill: '9 botanicals + 3 micronutrients',
    madeForTitle: 'Care for your lungs, every day',
  },
  'liver-booster': {
    photo: 'assets/products/showcase-liver.jpg',
    illustration: 'assets/illustrations/liver-botanical.webp',
    helps: [
      ['HeartPulse', 'General liver wellness'],
      ['Soup', 'Digestive well-being after rich meals'],
      ['Sparkles', 'Botanicals with traditional antioxidant use'],
      ['Moon', 'Support for modern lifestyle load'],
      ['Droplet', 'Easy, measured liquid format'],
    ],
    pill: '13 botanicals in every dose',
    madeForTitle: 'Your liver works hard. Care for it daily.',
  },
  'cyclerelief-roll-on': {
    photo: 'assets/products/showcase-rollon.jpg',
    card: true, // pack shot is on a grey studio background
    illustration: 'assets/illustrations/cycle.webp',
    illustrationPhoto: true,
    helps: [
      ['Flower2', 'A soothing period-care massage ritual'],
      ['Smile', 'Helps you relax during your cycle'],
      ['Feather', 'Fast-absorbing, non-greasy feel'],
      ['Leaf', '100% plant-based essential oils'],
      ['Briefcase', 'Pocket-size 8 ml for on-the-go comfort'],
    ],
    pill: 'Dill + Eucalyptus essential oils',
    madeForTitle: 'Comfort for every cycle',
  },
  'reviva-roll-on': {
    photo: 'assets/products/showcase-reviva.jpg',
    card: true, // white pack on white: shows the lifestyle photo instead
    illustration: 'assets/illustrations/reviva.webp',
    illustrationPhoto: true,
    helps: [
      ['Sun', 'A refreshing ritual for daily vitality'],
      ['Timer', 'A calm two-minute self-care break'],
      ['HandHeart', 'Gentle massage on clean, intact skin'],
      ['Feather', 'Fast-absorbing, non-greasy roll-on'],
      ['Briefcase', 'Portable 50 ml for home, work & travel'],
    ],
    pill: 'Dill + Eucalyptus essential oils',
    madeForTitle: 'A daily ritual for your blood-sugar routine',
  },
  'energy-booster': {
    photo: 'assets/products/showcase-energy.jpg',
    illustration: null,
    helps: [
      ['Zap', 'Complements daily energy & activity'],
      ['Activity', 'Supports general well-being'],
      ['Sprout', 'Botanical + mineral-origin blend'],
      ['Footprints', 'Made for busy, active adults'],
      ['Droplet', 'Ready-to-use oral liquid'],
    ],
    pill: '5 botanical & mineral actives',
    madeForTitle: 'For days that ask for more',
  },
  'breathefree-inhaler': {
    photo: 'assets/products/showcase-inhaler.jpg',
    card: true, // white pack on white: shows the lifestyle photo instead
    illustration: 'assets/illustrations/inhaler.webp',
    illustrationPhoto: true,
    helps: [
      ['Wind', 'Fresh, aromatic breaths on the go'],
      ['Brain', 'A calming pause for stressful moments'],
      ['CigaretteOff', 'A pause to reach for when cravings hit'],
      ['ShieldCheck', 'Nicotine-free, non-addictive formula'],
      ['Plane', 'Travel friendly, fits in any pocket'],
    ],
    pill: 'Natural essential-oil blend',
    madeForTitle: 'Breathe in. Slow down.',
  },
};
