// Ingredient library. "Traditional use" notes describe how an ingredient has
// been used in Ayurveda / folk practice; they are not claims about what a
// TranzLife product does. Ingredient lists follow the client's product document
// ("Tranzlife Biosciences Products.pdf", Nov 2026) and the packs.

export const INGREDIENT_TYPES = {
  herb: { label: 'Ayurvedic herb', color: '#2f6b3a' },
  oil: { label: 'Essential oil', color: '#14806a' },
  nutrient: { label: 'Micronutrient', color: '#b7791f' },
  homeo: { label: 'Homeopathic preparation', color: '#6b4fa0' },
  base: { label: 'Base & sweetener', color: '#8a6d3b' },
};

export const INGREDIENTS = [
  // Respiratory herbs
  { id: 'tulsi', name: 'Tulsi', alt: 'Holy Basil', latin: 'Ocimum sanctum', type: 'herb', part: 'Leaf', note: 'Revered in Indian homes as the “queen of herbs”. Traditionally taken as kadha for the throat, chest and seasonal wellness, and valued as an adaptogen for stress.' },
  { id: 'vasaka', name: 'Vasaka', alt: 'Adulsa / Malabar Nut', latin: 'Adhatoda vasica', type: 'herb', part: 'Leaf', note: 'A classical Ayurvedic herb for the respiratory tract. Traditionally used in preparations for the chest and airways.' },
  { id: 'mulethi', name: 'Mulethi', alt: 'Licorice Root', latin: 'Glycyrrhiza glabra', type: 'herb', part: 'Root', note: 'Naturally sweet root traditionally used to soothe the throat. A common ingredient in Ayurvedic respiratory blends.' },
  { id: 'sukku', name: 'Sukku', alt: 'Dry Ginger', latin: 'Zingiber officinale', type: 'herb', part: 'Dried rhizome', note: 'A warming kitchen spice, one of the three “Trikatu” herbs. Traditionally used for digestion and warmth in the chest.' },
  { id: 'thippili', name: 'Thippili', alt: 'Long Pepper', latin: 'Piper longum', type: 'herb', part: 'Fruit', note: 'Another Trikatu herb. Traditionally used in Siddha and Ayurveda for respiratory and digestive wellness.' },
  { id: 'black-pepper', name: 'Black Pepper', alt: 'Milagu', latin: 'Piper nigrum', type: 'herb', part: 'Fruit', note: 'The third Trikatu spice. Its aroma is sharp and clearing, and it is traditionally paired with other herbs to support their use in the body.' },
  { id: 'jeera', name: 'Jeera', alt: 'Cumin', latin: 'Cuminum cyminum', type: 'herb', part: 'Seed', note: 'A familiar kitchen seed traditionally used for digestion and gut comfort.' },
  { id: 'karumanjal', name: 'Karumanjal', alt: 'Black Turmeric', latin: 'Curcuma caesia', type: 'herb', part: 'Rhizome', note: 'A rare relative of turmeric with a blue-black core. Traditionally used in folk remedies for the chest and for its warming nature.' },
  { id: 'small-onion', name: 'Small Onion Extract', alt: 'Shallot / Chinna Vengayam', latin: 'Allium cepa var. aggregatum', type: 'herb', part: 'Bulb', note: 'A South Indian home staple, traditionally used with honey or jaggery during seasonal coughs and colds.' },
  { id: 'vitamin-c', name: 'Vitamin C', alt: 'Ascorbic acid', latin: '', type: 'nutrient', part: '', note: 'An essential vitamin that contributes to the normal function of the immune system and protects cells from oxidative stress.' },
  { id: 'vitamin-d3', name: 'Vitamin D3', alt: 'Cholecalciferol', latin: '', type: 'nutrient', part: '', note: 'The “sunshine vitamin”. Contributes to normal immune function and healthy bones and muscles. Many Indians are low in it.' },
  { id: 'zinc', name: 'Zinc', alt: 'Trace mineral', latin: '', type: 'nutrient', part: '', note: 'A trace mineral that contributes to normal immune function and cell protection.' },

  // Liver herbs
  { id: 'amla', name: 'Amla', alt: 'Indian Gooseberry', latin: 'Phyllanthus emblica', type: 'herb', part: 'Fruit', note: 'One of the richest natural sources of Vitamin C and a pillar of Ayurveda. Traditionally used for digestion, antioxidant support and rejuvenation.' },
  { id: 'bhumyamalaki', name: 'Bhumyamalaki', alt: 'Keezhanelli', latin: 'Phyllanthus niruri', type: 'herb', part: 'Whole plant', note: 'Known in Tamil homes as Keezhanelli. One of the most traditionally used herbs for liver wellness in South India.' },
  { id: 'kalmegh', name: 'Kalmegh', alt: 'King of Bitters', latin: 'Andrographis paniculata', type: 'herb', part: 'Leaf', note: 'An intensely bitter herb traditionally used for the liver and digestion, and studied for its antioxidant activity.' },
  { id: 'kutki', name: 'Kutki', alt: 'Picrorhiza', latin: 'Picrorhiza kurroa', type: 'herb', part: 'Root', note: 'A Himalayan bitter root used in classical Ayurveda for liver function and digestion.' },
  { id: 'giloy', name: 'Giloy', alt: 'Guduchi', latin: 'Tinospora cordifolia', type: 'herb', part: 'Stem', note: 'Called “Amrita” in Ayurveda. Traditionally used as a rejuvenating herb and for immune and liver support.' },
  { id: 'punarnava', name: 'Punarnava', alt: 'Spreading Hogweed', latin: 'Boerhavia diffusa', type: 'herb', part: 'Whole plant', note: 'Its name means “one that renews”. Traditionally used for liver and kidney wellness.' },
  { id: 'daruharidra', name: 'Daruharidra', alt: 'Indian Barberry', latin: 'Berberis aristata', type: 'herb', part: 'Stem', note: 'A classical Ayurvedic bitter herb, related to turmeric in name and colour. Traditionally used for the liver and digestion.' },
  { id: 'haritaki', name: 'Haritaki', alt: 'Kadukkai', latin: 'Terminalia chebula', type: 'herb', part: 'Fruit', note: 'Called the “king of medicines” in Tibetan tradition and one of the three Triphala fruits. Traditionally used for digestion and gentle cleansing.' },
  { id: 'turmeric', name: 'Turmeric', alt: 'Manjal / Haldi', latin: 'Curcuma longa', type: 'herb', part: 'Rhizome', note: 'The golden kitchen spice. Its curcumin is widely studied for antioxidant activity, and it is traditionally used for digestion and the liver.' },
  { id: 'bhringraj', name: 'Bhringraj', alt: 'Karisalankanni', latin: 'Eclipta prostrata', type: 'herb', part: 'Whole plant', note: 'Famous for hair care, and also traditionally used in Siddha medicine as a liver herb.' },

  // Essential oils
  { id: 'dill', name: 'Dill Oil', alt: 'Sowa', latin: 'Anethum graveolens', type: 'oil', part: 'Seed', note: 'Dill (sowa) seeds are a traditional Indian home remedy for tummy comfort. The essential oil has a warm, sweet, herbal aroma.' },
  { id: 'eucalyptus', name: 'Eucalyptus Oil', alt: 'Nilgiri Thailam', latin: 'Eucalyptus globulus', type: 'oil', part: 'Leaf', note: 'The familiar Nilgiri oil. Cooling, fresh and clearing, widely used in massage and steam inhalation.' },
  { id: 'lemon', name: 'Lemon Oil', alt: 'Nimbu', latin: 'Citrus limon', type: 'oil', part: 'Peel', note: 'Bright, zesty and uplifting. Cold-pressed from lemon peel and popular in aromatherapy for a fresh, clean feel.' },
  { id: 'wintergreen', name: 'Wintergreen Oil', alt: 'Gaultheria', latin: 'Gaultheria procumbens', type: 'oil', part: 'Leaf', note: 'A naturally warming oil traditionally massaged over tired muscles, with a sweet, minty aroma.' },
  { id: 'ginger-oil', name: 'Ginger Essential Oil', alt: 'Inji', latin: 'Zingiber officinale', type: 'oil', part: 'Rhizome', note: 'A warm, spicy oil distilled from ginger root, traditionally used in comforting massage blends.' },
  { id: 'sesame-oil', name: 'Sesame Oil', alt: 'Nallennai / Gingelly', latin: 'Sesamum indicum', type: 'oil', part: 'Seed', note: 'The classic Ayurvedic massage base oil. Nourishing and easily absorbed, it carries the other oils on the skin.' },
  { id: 'peppermint', name: 'Peppermint Oil', alt: 'Mint oil', latin: 'Mentha × piperita', type: 'oil', part: 'Leaf', note: 'Bright, cooling and refreshing. One of the most popular oils in aromatherapy.' },
  { id: 'peppermint-leaf', name: 'Peppermint', alt: 'Mentha piperita', latin: 'Mentha piperita', type: 'herb', part: 'Leaf', note: 'The classic cooling mint, naturally rich in menthol, with a bright, refreshing flavour.' },
  { id: 'pudina', name: 'Pudina', alt: 'Indian Mint', latin: 'Mentha arvensis', type: 'herb', part: 'Leaf', note: 'The everyday Indian mint of chutneys and chaas. Naturally rich in menthol, with a cooling, refreshing feel.' },
  { id: 'spearmint', name: 'Spearmint', alt: 'Garden mint', latin: 'Mentha spicata', type: 'herb', part: 'Leaf', note: 'A softer, sweeter mint than peppermint, adding a gentle, fresh flavour.' },
  { id: 'ginger', name: 'Ginger', alt: 'Inji / Adrak', latin: 'Zingiber officinale', type: 'herb', part: 'Rhizome', note: 'A warming kitchen root traditionally used in Indian homes for the throat, chest and digestion.' },
  { id: 'mct', name: 'MCT', alt: 'Coconut-derived', latin: 'Medium-chain triglycerides', type: 'base', part: '', note: 'A light, coconut-derived carrier that holds the botanical actives in the drops.' },
  { id: 'stevia', name: 'Stevia', alt: 'Sweet leaf', latin: 'Stevia rebaudiana', type: 'base', part: 'Leaf', note: 'A plant-based sweetener used in place of sugar.' },
  { id: 'lavender', name: 'Lavender Oil', alt: '', latin: 'Lavandula angustifolia', type: 'oil', part: 'Flower', note: 'Soft, floral and widely used in aromatherapy for relaxation and calm.' },
  { id: 'lemon', name: 'Lemon Oil', alt: '', latin: 'Citrus limon', type: 'oil', part: 'Peel', note: 'Bright, zesty and uplifting. A fresh citrus note widely used in aromatherapy.' },
  { id: 'wintergreen', name: 'Wintergreen Oil', alt: '', latin: 'Gaultheria procumbens', type: 'oil', part: 'Leaf', note: 'A cooling oil with a minty aroma, long used in massage oils and balms.' },
  { id: 'ginger-oil', name: 'Ginger Essential Oil', alt: '', latin: 'Zingiber officinale', type: 'oil', part: 'Rhizome', note: 'Warm and spicy. Used in massage blends for a comforting, warming feel.' },
  { id: 'sesame', name: 'Sesame Oil', alt: 'Nallennai / Til oil', latin: 'Sesamum indicum', type: 'oil', part: 'Seed', note: 'The classic Ayurvedic massage base oil, valued for its nourishing feel on the skin.' },

  // Energy Booster
  { id: 'ruta', name: 'Ruta graveolens (Q)', alt: 'Rue', latin: 'Ruta graveolens', type: 'homeo', part: 'Mother tincture', note: 'A botanical mother tincture traditionally associated with tired muscles and joints.' },
  { id: 'hecla-lava', name: 'Hecla lava (3X)', alt: 'Volcanic ash', latin: '', type: 'homeo', part: 'Mineral', note: 'A mineral-origin homeopathic preparation from volcanic ash, traditionally associated with bone health.' },
  { id: 'symphytum', name: 'Symphytum officinale (Q)', alt: 'Comfrey', latin: 'Symphytum officinale', type: 'homeo', part: 'Mother tincture', note: 'Known as “knitbone”, comfrey has a long traditional association with bones and tissues.' },
  { id: 'calc-phos', name: 'Calcarea phosphorica (8X)', alt: 'Calcium phosphate', latin: '', type: 'homeo', part: 'Mineral', note: 'A mineral-origin tissue salt traditionally associated with vitality, growth and recovery.' },
  { id: 'echinacea', name: 'Echinacea angustifolia (Q)', alt: 'Coneflower', latin: 'Echinacea angustifolia', type: 'homeo', part: 'Mother tincture', note: 'A popular botanical traditionally associated with immune support and general vitality.' },
];

export const getIngredient = (id) => INGREDIENTS.find((i) => i.id === id);

const INGREDIENT_IMG_MAP = {
  mulethi: 'licorice',
  pudina: 'peppermint',
  'peppermint-leaf': 'peppermint',
  spearmint: 'peppermint',
  'ginger-oil': 'ginger',
  'sesame-oil': 'sesame',
  sukku: 'ginger',
  thippili: 'long-pepper',
  jeera: 'cumin',
  karumanjal: 'black-turmeric',
  giloy: 'guduchi',
  'ginger-oil': 'ginger',
};

// a photo uploaded in the admin dashboard wins over the built-in one
export const getIngredientImg = (id) => {
  const uploaded = getIngredient(id)?.photoUrl;
  if (uploaded) return uploaded;
  const filename = INGREDIENT_IMG_MAP[id] || id;
  return `/assets/ingredients/cutout/${filename}.webp`;
};

export const getIngredientPhoto = (id) => {
  const uploaded = getIngredient(id)?.photoUrl;
  if (uploaded) return uploaded;
  const filename = INGREDIENT_IMG_MAP[id] || id;
  return `/assets/ingredients/${filename}.webp`;
};

/** Live library from the database (GET /api/ingredients), replacing the built-in list in place. */
export function replaceIngredients(list) {
  if (Array.isArray(list) && list.length) INGREDIENTS.splice(0, INGREDIENTS.length, ...list);
}
