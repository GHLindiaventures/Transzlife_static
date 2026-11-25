// TranzLife product catalogue.
// Content follows the client's product document "Tranzlife Biosciences Products.pdf" (Nov 2026):
// introduction, key benefits, ingredients, how to use, how it works, features, and the details
// printed on the actual packs (directions, cautions, storage, certifications). Marketing copy uses
// the document's wellness wording; disease claims printed on some packs (e.g. "support for
// diabetes", "detoxification") are deliberately not repeated here.
// Prices are the client's MRPs (24 Nov 2026), sold at MRP; BreatheFree is still a placeholder.
// Checkout charges the prices in the database (admin > Products). Migration 009 copies this
// content into the database for existing shops.

export const PRODUCTS = [
  {
    id: 'pulmoclear-gummies',
    name: 'PulmoClear™ Gummies',
    short: 'PulmoClear Gummies',
    tagline: 'Ayurvedic botanicals with Vitamin C, D3 & Zinc for respiratory wellness',
    format: 'Gummies',
    size: '60 Gummies',
    price: 200,
    mrp: 200,
    badge: 'New',
    accent: '#1f6b34',
    tint: '#eaf4e6',
    concerns: ['respiratory', 'quit-smoking'],
    images: ['/img/p/pulmoclear.webp', '/img/p/pulmoclear-jar.webp'],
    brochure: '/brochures/pulmoclear.pdf',
    highlights: ['9 Ayurvedic botanicals', 'Vitamin C, D3 & Zinc', 'Natural berry flavour', '60 gummies per pack'],
    summary:
      'A botanical-based wellness supplement that combines traditional Ayurvedic herbs with essential vitamins and minerals, designed to support respiratory wellness and everyday health.',
    description: [
      'TranzLife PulmoClear™ Gummies combine traditional Ayurvedic herbs such as Tulsi, Vasaka, licorice root, dry ginger and long pepper with Vitamin C, Vitamin D3 and Zinc.',
      'Together they provide nutritional and botanical support for everyday respiratory wellness, in an easy-to-take gummy with a natural berry flavour.',
    ],
    benefits: [
      'Supports respiratory wellness',
      'Provides antioxidant support',
      'Supports natural immune function',
      'Enriched with essential vitamins and minerals',
      'Combines traditional Ayurvedic botanicals with selected nutrients',
      'Convenient daily wellness supplement',
    ],
    ingredients: ['jeera', 'karumanjal', 'sukku', 'thippili', 'black-pepper', 'tulsi', 'vasaka', 'mulethi', 'small-onion', 'vitamin-c', 'vitamin-d3', 'zinc'],
    routine: [
      { label: 'Dose', value: 'As per pack label' },
      { label: 'Format', value: 'Chewable gummy' },
      { label: 'Pack', value: '60 gummies' },
    ],
    howToUse: [
      'Follow the serving size and frequency mentioned on the approved product packaging.',
      'Do not exceed the recommended daily intake.',
    ],
    whoFor: [
      'Adults who want daily respiratory wellness support',
      'People living in polluted or dusty cities',
      'Anyone who prefers an easy-to-consume gummy to capsules',
    ],
    precautions: [
      'Do not exceed the recommended daily intake.',
      'Not a substitute for prescribed respiratory medicines or medical care.',
      'Pregnant, breastfeeding, taking medication or managing a medical condition? Consult a healthcare professional before use.',
      'Keep out of reach of children.',
    ],
    faqs: [
      ['What are PulmoClear™ Gummies?', 'A botanical-based wellness supplement combining traditional Ayurvedic herbs with essential vitamins and minerals, designed to support respiratory wellness and everyday health.'],
      ['What is inside?', 'Botanicals: Jeera (cumin), Karumanjal (black turmeric), Sukku (dry ginger), Thippili (long pepper), black pepper, Tulsi, Vasaka, licorice root and small onion extract. Added nutrients: Vitamin C, Vitamin D3 and Zinc.'],
      ['How many gummies should I take?', 'Follow the serving size and frequency on the approved pack label. Do not exceed the recommended daily intake.'],
      ['How does it work?', 'It combines traditional Ayurvedic botanicals with essential vitamins and minerals to provide nutritional and botanical support for everyday respiratory wellness.'],
      ['What flavour is it, and how many are in a pack?', 'Natural berry flavour, 60 gummies per pack.'],
    ],
    compliance: { netQuantity: '60 gummies' },
  },
  {
    id: 'liver-booster',
    name: 'TranzLife Liver Booster',
    short: 'Liver Booster',
    tagline: 'Polyherbal Ayurvedic concoction for liver and digestive wellness',
    format: 'Herbal Liquid',
    size: '500 ml',
    price: 900,
    mrp: 900,
    badge: 'Bestseller',
    accent: '#7a3b12',
    tint: '#f6efe6',
    concerns: ['liver'],
    images: ['/img/p/liver.webp'],
    brochure: '/brochures/liver-booster.pdf',
    highlights: ['11 Ayurvedic botanicals', 'Bhumyamalaki, Kalmegh & Kutki', 'No added colours or sugar', 'GMP certified, made in India'],
    summary:
      'A botanical-based wellness product formulated with traditional herbal ingredients, designed to support normal liver function, digestive wellness and overall well-being.',
    description: [
      'TranzLife Liver Booster (LiverDetox) is a polyherbal Ayurvedic concoction that brings together 11 traditional botanicals associated with liver and digestive wellness, led by Bhumyamalaki, Kalmegh and Kutki.',
      'Each 10 ml contains Bhumyamalaki (Phyllanthus niruri) 500 mg, Kalmegh (Andrographis paniculata) 400 mg, Kutki (Picrorhiza kurroa) 400 mg, Punarnava (Boerhaavia diffusa) 300 mg, Bhringraj (Eclipta alba) 300 mg, Daruharidra (Berberis aristata) 200 mg, Guduchi (Tinospora cordifolia) 200 mg, Amla (Emblica officinalis) 200 mg, Haritaki (Terminalia chebula) 200 mg, Turmeric (Curcuma longa) 150 mg and black pepper (Piper nigrum) 50 mg, with excipients q.s.',
    ],
    benefits: [
      'Supports normal liver function',
      'Provides antioxidant support',
      'Supports natural metabolic processes',
      'Supports digestive health and appetite',
      'A blend of traditional botanical ingredients',
      'Designed for everyday wellness support',
    ],
    ingredients: ['bhumyamalaki', 'kalmegh', 'kutki', 'punarnava', 'bhringraj', 'daruharidra', 'giloy', 'amla', 'haritaki', 'turmeric', 'black-pepper'],
    routine: [
      { label: 'Dose', value: '10 ml (2 tsp)' },
      { label: 'When', value: 'Twice daily after meals' },
      { label: 'Tip', value: 'Shake well; refrigerate after opening' },
    ],
    howToUse: [
      'Shake well before use.',
      'Adults: take 10 ml (2 teaspoons) twice daily after meals, using a suitable measuring cup.',
      'Follow the dosage and duration on the approved product label, or as advised by a healthcare professional.',
      'Store in a cool, dry place away from direct sunlight. Refrigerate after opening.',
    ],
    whoFor: [
      'Adults who want to look after their liver and digestive wellness',
      'People with lifestyle habits that add to liver load (rich food, stress, alcohol)',
      'Anyone looking for a plant-based daily wellness routine',
    ],
    precautions: [
      'Not recommended for pregnant or lactating women.',
      'Consult your physician if you are under medication.',
      'Not a replacement for medical diagnosis, prescribed treatment or monitoring.',
      'Keep out of reach of children.',
    ],
    faqs: [
      ['What is TranzLife Liver Booster?', 'A polyherbal Ayurvedic concoction (Ayurvedic Proprietary Medicine) made with 11 traditional botanicals, designed to support normal liver function, digestive wellness and overall well-being.'],
      ['What is the dosage?', 'Adults: 10 ml (2 teaspoons) twice daily after meals. Shake well before use. Follow the pack label or the advice of a healthcare professional.'],
      ['What is in each 10 ml?', 'Bhumyamalaki 500 mg, Kalmegh 400 mg, Kutki 400 mg, Punarnava 300 mg, Bhringraj 300 mg, Daruharidra 200 mg, Guduchi 200 mg, Amla 200 mg, Haritaki 200 mg, Turmeric 150 mg, black pepper 50 mg, excipients q.s.'],
      ['Does it contain sugar, colours or gluten?', 'No added sugar, no added colours and no artificial flavours. It is gluten-free and vegetarian. Flavour: mixed.'],
      ['Who should not take it?', 'It is not recommended for pregnant or lactating women. If you take medication or have a liver condition, consult your physician first.'],
      ['How should I store it?', 'In a cool, dry place away from direct sunlight. Refrigerate after opening.'],
    ],
    compliance: { netQuantity: '500 ml', countryOfOrigin: 'India', storage: 'Store in a cool, dry place away from direct sunlight. Refrigerate after opening.', certifications: ['100% Ayurvedic', 'GMP Certified', 'No added sugar', 'No added colours'] },
  },
  {
    id: 'cyclerelief-roll-on',
    name: 'CycleRelief™ Roll-On',
    short: 'CycleRelief Roll-On',
    tagline: 'Plant-based roll-on for menstrual comfort',
    format: 'Roll-On',
    size: '8 ml',
    price: 299,
    mrp: 299,
    badge: 'For Her',
    accent: '#6b2d8c',
    tint: '#f3ebf8',
    concerns: ['menstrual'],
    images: ['/img/p/cyclerelief.webp'],
    brochure: '/brochures/cyclerelief.pdf',
    highlights: ['6 plant oils incl. Wintergreen & Ginger', 'Non-greasy roll-on', 'Plant-based, not tested on animals', 'Compact 8 ml, fits any bag'],
    summary:
      'A plant-based topical roll-on designed for menstrual comfort and personal care, for a soothing self-care and relaxation routine during your cycle.',
    description: [
      'TranzLife CycleRelief™ blends Wintergreen, Peppermint, Ginger, Lavender and Eucalyptus oils in a Sesame oil base, for a comforting massage during the menstrual cycle.',
      'Roll it onto the lower abdomen, lower back or inner wrists and massage gently. The non-greasy formula absorbs easily, and the compact 8 ml pack goes wherever you do.',
    ],
    benefits: [
      'Designed to support menstrual comfort routines',
      'Provides a soothing, comforting massage',
      'Helps relax muscle tension',
      'Easy-to-apply, non-greasy roll-on',
      'Convenient for use during the menstrual cycle',
    ],
    ingredients: ['wintergreen', 'peppermint', 'ginger-oil', 'lavender', 'eucalyptus', 'sesame'],
    routine: [
      { label: 'Apply', value: 'Lower abdomen, lower back or wrists' },
      { label: 'How often', value: '2–4 times daily as needed' },
      { label: 'Use', value: 'External only' },
    ],
    howToUse: [
      'Perform a patch test before first use.',
      'Roll onto the lower abdomen, lower back or inner wrists (intact skin only).',
      'Massage gently until absorbed.',
      'Reapply 2–4 times daily, or as needed during the menstrual cycle.',
    ],
    whoFor: [
      'Women who want a soothing self-care routine during their period',
      'Anyone who prefers plant-based personal care',
      'Students and working women who want on-the-go comfort',
    ],
    precautions: [
      'For external use only.',
      'Avoid contact with eyes, mucous membranes and broken or irritated skin.',
      'Do not use on children. Keep out of reach of children.',
      'Discontinue use if irritation occurs.',
      'Store in a cool, dry place away from direct sunlight, with the container tightly closed.',
    ],
    faqs: [
      ['What is CycleRelief™ Roll-On?', 'A plant-based topical roll-on designed for menstrual comfort and personal care, as part of a soothing self-care and relaxation routine.'],
      ['What is in it?', 'Wintergreen oil, peppermint oil, ginger essential oil, lavender essential oil, eucalyptus oil and sesame oil.'],
      ['Where and how often do I apply it?', 'Roll onto the lower abdomen, lower back or inner wrists and massage gently until absorbed. Reapply 2–4 times daily or as needed during the cycle.'],
      ['Is it a painkiller?', 'No. It is an external personal-care product for comfort and relaxation, not a medicine. Severe or unusual period pain should be checked by a doctor.'],
      ['Can children use it?', 'No. Do not use on children, and keep it out of their reach.'],
    ],
    compliance: { netQuantity: '8 ml', countryOfOrigin: 'India', storage: 'Store in a cool, dry place away from direct sunlight. Keep the container tightly closed.', certifications: ['ISO 9001:2015', 'GMP Certified', 'Plant-based', 'Not tested on animals', 'Recyclable packaging'] },
  },
  {
    id: 'reviva-roll-on',
    name: 'Reviva™ Roll-On',
    short: 'Reviva Roll-On',
    tagline: 'Botanical massage roll-on for a daily self-care routine',
    format: 'Massage Roll-On',
    size: '50 ml',
    price: 699,
    mrp: 699,
    badge: null,
    accent: '#e0701a',
    tint: '#fdf1e5',
    concerns: ['blood-sugar'],
    images: ['/img/p/reviva.webp'],
    brochure: '/brochures/reviva.pdf',
    highlights: ['Dill & Eucalyptus essential oils', 'Gentle massage roll-on', 'Portable 50 ml pack', 'ISO 9001:2015 & GMP certified'],
    summary:
      'A botanical-inspired massage roll-on with Dill and Eucalyptus essential oils, designed for external application as part of a daily personal-care and wellness routine.',
    description: [
      'TranzLife Reviva™ adds a simple, refreshing massage to your morning. Its Dill and Eucalyptus essential oils give a fresh, herbal feel as you roll it gently around the belly button.',
      'The convenient 50 ml roll-on needs no preparation and travels easily, so the routine is easy to keep every day.',
    ],
    benefits: [
      'Provides a refreshing topical application',
      'Supports a daily self-care routine',
      'Offers a convenient massage application',
      'Combines Dill and Eucalyptus essential oils',
      'Supports a refreshing personal-care experience',
    ],
    ingredients: ['dill', 'eucalyptus'],
    routine: [
      { label: 'Apply', value: 'Around the belly button' },
      { label: 'When', value: 'Every morning, empty stomach' },
      { label: 'Use', value: 'External only' },
    ],
    howToUse: [
      'Roll gently around the belly button on intact skin, and massage gently.',
      'Apply every morning on an empty stomach. Use daily for best results.',
      'Follow the approved product label for application frequency.',
      'Wash hands after use.',
    ],
    whoFor: [
      'Adults who want a simple daily self-care ritual',
      'People who enjoy botanical massage and personal-care products',
      'Anyone looking for a quick, refreshing start to the day',
    ],
    precautions: [
      'For external use only. Apply on intact skin; avoid eyes and mucous membranes.',
      'Not a replacement for prescribed medicines, monitoring or medical advice.',
      'Discontinue use if irritation occurs.',
      'Keep out of reach of children.',
    ],
    faqs: [
      ['What is Reviva™ Roll-On?', 'A botanical-inspired massage roll-on with Dill and Eucalyptus essential oils, designed for external application as part of a daily personal-care and wellness routine.'],
      ['How do I use it?', 'Roll gently around the belly button every morning on an empty stomach and massage gently. Use daily, and wash your hands after use.'],
      ['What are the ingredients?', 'Dill essential oil and Eucalyptus essential oil.'],
      ['Is it a medicine?', 'No. It is a topical personal-care product. Please continue any medicines and check-ups your doctor has advised.'],
      ['Can I use it on cuts or irritated skin?', 'No. Only apply on intact skin.'],
    ],
    compliance: { netQuantity: '50 ml', certifications: ['ISO 9001:2015', 'GMP Certified'] },
  },
  {
    id: 'energy-booster',
    name: 'TranzLife Energy Booster™',
    short: 'Energy Booster',
    tagline: 'Herbal and bioactive oral liquid for everyday energy and stamina',
    format: 'Oral Liquid',
    size: '500 ml',
    price: 1850,
    mrp: 1850,
    badge: 'Bestseller',
    accent: '#5b2a6e',
    tint: '#f4ecf6',
    concerns: ['energy'],
    images: ['/img/p/energy.webp'],
    brochure: '/brochures/energy-booster.pdf',
    highlights: ['Botanical + mineral blend', 'Easy-to-measure dosage', 'For active adults', '500 ml pack'],
    summary:
      'A herbal and bioactive oral liquid formulation designed to complement an active lifestyle and support everyday energy, stamina and overall wellness.',
    description: [
      'TranzLife Energy Booster™ combines selected botanical and mineral-origin ingredients (Ruta graveolens, Hecla lava, Symphytum officinale, Calcarea phosphorica and Echinacea angustifolia) in an oral liquid.',
      'It is designed to complement daily energy, activity and general wellness, with an easy-to-measure dose that fits a simple daily routine.',
    ],
    benefits: [
      'Supports everyday energy and stamina',
      'Promotes overall vitality and well-being',
      'Supports hormonal wellness',
      'Supports healthy immune function',
      'Designed to complement an active lifestyle',
      'Supports daily wellness routines',
    ],
    ingredients: ['ruta', 'hecla-lava', 'symphytum', 'calc-phos', 'echinacea'],
    routine: [
      { label: 'Dose', value: '7.5 ml' },
      { label: 'When', value: 'Twice daily' },
      { label: 'Tip', value: 'Use the measure supplied' },
    ],
    howToUse: [
      'Suggested dosage: 7.5 ml twice daily.',
      'Use the measuring device supplied with the pack.',
      'Take as recommended by a healthcare professional, and follow the approved product label.',
    ],
    whoFor: [
      'Adults who want to support everyday energy and stamina',
      'People with active, busy lifestyles',
      'Anyone looking for a convenient daily wellness routine',
    ],
    precautions: [
      'Use only as directed. Do not exceed the recommended dose.',
      'Pregnant or breastfeeding? Consult a qualified healthcare professional before use.',
      'Taking medication or managing a health condition? Consult your doctor first.',
      'Keep out of reach of children. Store in a cool, dry place.',
    ],
    faqs: [
      ['What is TranzLife Energy Booster™?', 'A herbal and bioactive oral liquid formulation (500 ml) designed to complement an active lifestyle and support everyday energy, stamina and overall wellness.'],
      ['How much should I take?', 'The suggested dosage is 7.5 ml twice daily, using the measuring device supplied, or as recommended by a healthcare professional.'],
      ['What are the ingredients?', 'Ruta graveolens (Q), Hecla lava (3X), Symphytum officinale (Q), Calcarea phosphorica (8X) and Echinacea angustifolia (Q).'],
      ['How does it work?', 'It combines selected botanical and mineral-origin ingredients in an oral liquid, designed to complement daily energy, activity and general wellness.'],
      ['Can I take it with my regular medicines?', 'Please check with your doctor before combining it with prescription medicines.'],
    ],
    compliance: { netQuantity: '500 ml' },
  },
  {
    id: 'breathefree-inhaler',
    name: 'BreatheFree™ Aromatherapy Inhaler',
    short: 'BreatheFree Inhaler',
    tagline: 'Essential-oil inhaler for your journey to a smoke-free life',
    format: 'Aromatherapy Inhaler',
    size: 'Pocket inhaler',
    price: 249,
    mrp: 299,
    badge: null,
    accent: '#14806a',
    tint: '#e6f4f0',
    concerns: ['quit-smoking', 'stress', 'respiratory'],
    images: ['/img/p/breathefree.webp'],
    brochure: null,
    highlights: ['6 essential oils', 'Non-addictive formulation', 'Compact and pocket-sized', 'Discreet, use anytime'],
    summary:
      'An essential oil-based aromatherapy inhaler designed to support you on your journey towards a smoke-free lifestyle, with a convenient aromatic experience for relaxation, freshness and breathing comfort.',
    description: [
      'TranzLife BreatheFree™ blends Peppermint, Eucalyptus, Lavender, Lemon, Black Pepper and Tulsi oils. Its aroma is intended to promote relaxation, help manage cravings and support breathing comfort.',
      'Compact, pocket-sized and discreet, it is easy to carry while travelling or working, so support is there whenever a craving or a stressful moment comes.',
    ],
    benefits: [
      'Helps manage smoking cravings',
      'Promotes relaxation and emotional balance',
      'Supports a refreshing breathing experience',
      'Helps manage stress and irritability',
      'Convenient support during smoking-cessation efforts',
      'Non-addictive formulation',
    ],
    ingredients: ['peppermint', 'eucalyptus', 'lavender', 'lemon', 'black-pepper', 'tulsi'],
    routine: [
      { label: 'Use', value: 'Whenever cravings or stress come' },
      { label: 'How', value: 'Slow, deep inhalations' },
      { label: 'Carry', value: 'Pocket or bag' },
    ],
    howToUse: [
      'Gently remove the protective cap.',
      'Place the inhaler near each nostril.',
      'Take slow, deep inhalations.',
      'Repeat whenever you experience cravings or feel stressed.',
    ],
    whoFor: [
      'Smokers and people trying to quit',
      'Anyone looking for a calming, relaxing pause',
      'Travellers and commuters',
    ],
    precautions: [
      'For inhalation of the aroma only. Do not insert into the nose.',
      'People with asthma, allergies or essential-oil sensitivity should check with a doctor first.',
      'Pregnant or breastfeeding? Seek professional advice before use.',
      'Keep out of reach of children.',
    ],
    faqs: [
      ['What is BreatheFree™?', 'An essential oil-based aromatherapy inhaler designed to support people on their journey towards a smoke-free lifestyle.'],
      ['What is in it?', 'Peppermint, eucalyptus, lavender, lemon, black pepper and tulsi oils.'],
      ['Can it help me quit smoking?', 'Its aroma is intended to promote relaxation and help manage cravings, as convenient support during your quit attempt. It is not a nicotine replacement or a medicine.'],
      ['Is it addictive?', 'It contains no nicotine and is a non-addictive formulation.'],
      ['How do I use it?', 'Remove the cap, place the inhaler near each nostril and take slow, deep inhalations. Repeat whenever you experience cravings or feel stressed.'],
    ],
  },
];

export const getProduct = (id) => PRODUCTS.find((p) => p.id === id);

// Pack options shown on the product page (savings are placeholders).
export const PACKS = [
  { qty: 1, label: 'Pack of 1', off: 0 },
  { qty: 2, label: 'Pack of 2', off: 0.05, tag: 'Save 5%' },
  { qty: 3, label: 'Pack of 3', off: 0.1, tag: 'Best value' },
];

export const FORMATS = [...new Set(PRODUCTS.map((p) => p.format))];

// ---- Live catalogue -------------------------------------------------------
// The list above shows instantly; the database version (GET /api/products, managed in the admin
// dashboard) replaces it in place once loaded. Pages call useCatalog() (src/store/lib/catalog.js)
// so they re-render with the live data: prices, photos, copy, stock and new products.
const listeners = new Set();
let version = 0;
export const subscribeCatalog = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const catalogVersion = () => version;
/** The live catalogue could not be loaded: keep the built-in list, but stop waiting for it. */
export function markCatalogSettled() {
  if (version > 0) return;
  version = 1;
  listeners.forEach((fn) => fn(version));
}

export function replaceCatalog(list) {
  if (!Array.isArray(list) || !list.length) return;
  PRODUCTS.splice(0, PRODUCTS.length, ...list);
  FORMATS.splice(0, FORMATS.length, ...new Set(list.map((p) => p.format).filter(Boolean)));
  version += 1;
  listeners.forEach((fn) => fn(version));
}
