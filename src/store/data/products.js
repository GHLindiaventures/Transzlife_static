// TranzLife product catalogue.
// Content follows the client's product document "Tranzlife Biosciences Products.pdf" (Nov 2026):
// introduction, key benefits, ingredients, how to use, how it works, features, and the details
// printed on the actual packs (directions, cautions, storage, certifications). Marketing copy uses
// the document's wellness wording; disease claims printed on some packs (e.g. "support for
// diabetes", "detoxification") are deliberately not repeated here.
// Built-in prices: the client's MRPs (24 Nov 2026). Live shops charge the database prices: launch prices
// 5 to 10% below these MRPs since migration 019 (26 Nov 2026), editable in admin > Pricing & offers.
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
    images: ['/img/p/pulmoclear-v2.webp'],
    brochure: '/brochures/pulmoclear.pdf',
    highlights: ['9 Ayurvedic botanicals', 'Vitamin C, D3 & Zinc', 'Natural berry flavour', '60 gummies per pack'],
    summary:
      'A botanical-based wellness supplement combining traditional Ayurvedic herbs with essential vitamins and minerals, designed to support respiratory wellness and everyday health.',
    description: [
      'City air, dust, seasonal changes and smoking all ask a lot of your lungs. PulmoClear™ Gummies make respiratory self-care easy with a convenient, easy-to-consume gummy in a natural berry flavour.',
      'PulmoClear™ combines traditional Ayurvedic botanicals (Jeera, Karumanjal, Sukku, Thippili, Black Pepper, Tulsi, Vasaka, Licorice Root and Small Onion Extract) with Vitamin C, Vitamin D3 and Zinc, to provide nutritional and botanical support for everyday respiratory wellness.',
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
      { label: 'Format', value: 'Berry-flavour gummy' },
      { label: 'Pack', value: '60 gummies' },
    ],
    howToUse: [
      'Follow the serving size and frequency mentioned on the approved product packaging.',
      'Do not exceed the recommended daily intake.',
      'Use regularly as part of your everyday wellness routine.',
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
    tagline: 'Ayurvedic polyherbal concoction for liver and digestive wellness',
    format: 'Polyherbal Concoction',
    size: '500 ml',
    price: 900,
    mrp: 900,
    badge: null,
    accent: '#7a3b12',
    tint: '#f6efe6',
    concerns: ['liver'],
    images: ['/img/p/liver-v3.webp'],
    brochure: '/brochures/liver-booster.pdf',
    highlights: ['11 Ayurvedic botanicals', 'Bhumyamalaki, Kalmegh & Kutki', 'No added colours or sugar', 'Mixed flavour, 500 ml'],
    summary:
      'A botanical-based wellness product formulated using traditional herbal ingredients, designed to support normal liver function, digestive wellness and overall well-being.',
    description: [
      'Your liver quietly handles metabolism, digestion, nutrient storage and processing of everything you eat, drink and take. Modern habits such as rich food, stress, irregular sleep and alcohol add to that load.',
      'TranzLife Liver Booster combines 11 traditional botanical ingredients associated with liver and digestive wellness, including Bhumyamalaki, Kalmegh, Kutki and Punarnava, to provide botanical and antioxidant support for normal liver function and metabolic processes. An Ayurvedic proprietary medicine, GMP certified and made in India.',
    ],
    benefits: [
      'Supports normal liver function',
      'Provides antioxidant support',
      'Supports natural metabolic processes',
      'Supports digestive health and appetite',
      'Contains a blend of traditional botanical ingredients',
      'Designed for everyday wellness support',
    ],
    ingredients: ['bhumyamalaki', 'kalmegh', 'kutki', 'punarnava', 'bhringraj', 'daruharidra', 'giloy', 'amla', 'haritaki', 'turmeric', 'black-pepper'],
    // Composition per 10 ml, as printed on the pack (excipients q.s.)
    composition: {
      per: '10 ml',
      amounts: { bhumyamalaki: '500 mg', kalmegh: '400 mg', kutki: '400 mg', punarnava: '300 mg', bhringraj: '300 mg', daruharidra: '200 mg', giloy: '200 mg', amla: '200 mg', haritaki: '200 mg', turmeric: '150 mg', 'black-pepper': '50 mg' },
    },
    routine: [
      { label: 'Dose', value: '10 ml (2 tsp)' },
      { label: 'When', value: 'Twice daily after meals' },
      { label: 'Tip', value: 'Shake well; refrigerate after opening' },
    ],
    howToUse: [
      'Shake well before use.',
      'Adults: take 10 ml (2 teaspoons) twice daily after meals, using a suitable measuring cup.',
      'Follow the dosage and duration on the label, or as advised by your doctor.',
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
      'Store in a cool, dry place away from direct sunlight and refrigerate after opening. Keep out of reach of children.',
    ],
    faqs: [
      ['What is TranzLife Liver Booster?', 'A botanical-based Ayurvedic proprietary medicine (polyherbal concoction) formulated with 11 traditional herbal ingredients to support normal liver function, digestive wellness and overall well-being.'],
      ['What is inside?', 'Per 10 ml: Bhumyamalaki 500 mg, Kalmegh 400 mg, Kutki 400 mg, Punarnava 300 mg, Bhringraj 300 mg, Daruharidra 200 mg, Guduchi 200 mg, Amla 200 mg, Haritaki 200 mg, Turmeric 150 mg and Black Pepper 50 mg, with excipients q.s.'],
      ['What is the dosage?', 'Adults: 10 ml (2 teaspoons) twice daily after meals. Shake well before use, and follow the pack label or your healthcare professional’s advice.'],
      ['Can it cure fatty liver?', 'No. It is not a cure for fatty liver. If you have fatty liver or raised liver enzymes, please follow your doctor’s advice.'],
      ['Can I take it during pregnancy?', 'No. It is not recommended for pregnant or lactating women. If you are on any medication, consult your physician first.'],
      ['What size is the pack and how do I store it?', '500 ml, mixed flavour. Store in a cool, dry place away from direct sunlight and refrigerate after opening.'],
    ],
    compliance: { netQuantity: '500 ml', countryOfOrigin: 'India', storage: 'Store in a cool, dry place away from direct sunlight. Refrigerate after opening.', certifications: ['100% Ayurvedic', 'GMP Certified', 'No added sugar', 'No added colours'] },
  },
  {
    id: 'cyclerelief-roll-on',
    name: 'CycleRelief™ Roll-On',
    short: 'CycleRelief Roll-On',
    tagline: 'Natural support for menstrual comfort and well-being',
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
    highlights: ['6 plant-based oils', 'Wintergreen, Peppermint & Lavender', 'Easy-to-apply, non-greasy', 'Compact 8 ml roll-on'],
    summary:
      'A plant-based topical roll-on designed for menstrual comfort and personal care, for a soothing self-care and relaxation routine during the menstrual cycle.',
    description: [
      'Periods can bring cramps, heaviness and tension, and the days when you need a little extra care. CycleRelief™ is a compact roll-on for a calming massage ritual whenever you need it.',
      'Its blend of Wintergreen, Peppermint, Ginger, Lavender and Eucalyptus oils in Sesame oil provides an aromatherapy-inspired self-care experience through gentle massage, complementing relaxation and personal comfort routines. The easy-to-apply, non-greasy format fits in any bag.',
    ],
    benefits: [
      'Designed to support menstrual comfort routines',
      'Provides a soothing topical application',
      'Supports relaxation and personal comfort',
      'Easy-to-apply, non-greasy format',
      'Convenient for use during the menstrual cycle',
    ],
    ingredients: ['wintergreen', 'peppermint', 'ginger-oil', 'lavender', 'eucalyptus', 'sesame-oil'],
    routine: [
      { label: 'Apply', value: 'Lower abdomen, back or inner wrists' },
      { label: 'How', value: 'Massage until absorbed' },
      { label: 'When', value: '2–4 times daily, as needed' },
    ],
    howToUse: [
      'Perform a patch test before first use.',
      'Roll a small amount onto intact external skin of the lower abdomen, lower back or inner wrists.',
      'Massage gently until absorbed.',
      'Reapply 2–4 times daily or as needed during the menstrual cycle. Follow the approved product label directions.',
    ],
    whoFor: [
      'Women who want a soothing self-care routine during their period',
      'Anyone who prefers plant-based personal care',
      'Students and working women who want on-the-go comfort',
    ],
    precautions: [
      'For external use only. Avoid contact with eyes, mucous membranes and broken or irritated skin.',
      'Do not use on children. Keep out of reach of children.',
      'Discontinue use if irritation occurs.',
      'Store in a cool, dry place away from direct sunlight and keep the container tightly closed.',
      'Severe or unusual period pain? Please see a gynaecologist.',
    ],
    faqs: [
      ['What is CycleRelief™ Roll-On?', 'A plant-based topical roll-on designed for menstrual comfort and personal care, as part of a soothing self-care and relaxation routine during the menstrual cycle.'],
      ['What is inside?', 'Wintergreen Oil, Peppermint Oil, Ginger Essential Oil, Lavender Essential Oil, Eucalyptus Oil and Sesame Oil.'],
      ['Where do I apply it?', 'Roll it onto the lower abdomen, lower back or inner wrists, on intact skin, and massage gently until absorbed.'],
      ['How often can I use it?', '2–4 times daily, or as needed during the menstrual cycle. Follow the pack label.'],
      ['Is it a painkiller?', 'No. It is an external personal-care product for comfort and relaxation, not a medicine.'],
      ['Can children use it?', 'No. The pack says not to use it on children, and to keep it out of their reach.'],
      ['How big is the pack?', '8 ml, small enough for a pocket or handbag.'],
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
    images: ['/img/p/reviva-v3.webp'],
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
      { label: 'Where', value: 'Around the belly button' },
      { label: 'When', value: 'Every morning, empty stomach' },
      { label: 'Use', value: 'Daily, external only' },
    ],
    howToUse: [
      'Do a patch test on a small area of skin before first use.',
      'Apply a small amount to intact skin, rolling gently around the belly button.',
      'Gently roll and massage the application area, every morning on an empty stomach. Use daily, and follow the approved product label for application frequency.',
      'Do not apply to wounds or irritated skin. Wash hands after use.',
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
      ['What is Reviva™ Roll-On?', 'A botanical massage roll-on designed for external application and gentle massage as part of a daily self-care routine.'],
      ['Does it control blood sugar?', 'No. Reviva™ is a topical personal-care product. Please continue your prescribed medicines, diet and glucose monitoring as advised by your doctor.'],
      ['What are the ingredients?', 'Dill essential oil and Eucalyptus essential oil, in a skin-friendly base.'],
      ['How do I use it?', 'Roll gently around the belly button every morning on an empty stomach and massage gently. Use daily, on intact skin only.'],
      ['Can I use it on cuts or irritated skin?', 'No. Only apply on clean, intact skin.'],
      ['Should I do a patch test?', 'Yes, always patch test before first use.'],
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
    badge: null,
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
      'Suggested dosage: 7.5 ml twice daily, or as recommended by a healthcare professional.',
      'Measure each dose with the measuring device supplied with the pack.',
      'Follow the approved product label for usage instructions.',
      'Do not exceed the recommended serving.',
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
    mrp: 249,
    badge: null,
    accent: '#14806a',
    tint: '#e6f4f0',
    concerns: ['quit-smoking', 'stress', 'respiratory'],
    images: ['/img/p/breathefree-v2.webp'],
    brochure: null,
    highlights: ['6 essential oils', 'Non-addictive formulation', 'Compact & pocket-sized', 'Discreet, use whenever needed'],
    summary:
      'An essential oil-based aromatherapy inhaler designed to support you on your journey towards a smoke-free lifestyle, with a convenient aromatic experience that promotes relaxation, freshness and breathing comfort.',
    description: [
      'Cravings, stress and stuffy rooms all have one thing in common: they pass faster when you pause and breathe. BreatheFree™ gives you a clean, aromatic breath in seconds.',
      'Its blend of Peppermint, Eucalyptus, Lavender, Lemon, Black Pepper and Tulsi oils provides an aromatic inhalation experience intended to promote relaxation, help manage cravings and support breathing comfort. Compact, discreet and easy to carry while travelling or working.',
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
      { label: 'Use', value: 'When cravings or stress hit' },
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
      ['What is BreatheFree™?', 'An essential oil-based aromatherapy inhaler designed to support individuals on their journey towards a smoke-free lifestyle.'],
      ['What is inside?', 'Peppermint Oil, Eucalyptus Oil, Lavender Oil, Lemon Oil, Black Pepper Oil and Tulsi Oil.'],
      ['Can it help me quit smoking?', 'Many people use it as a calming pause when a craving hits. It is an aromatherapy product, not a nicotine replacement or medicine.'],
      ['Is it addictive?', 'It contains no nicotine and uses a non-addictive essential-oil formula.'],
      ['Does it treat asthma or blocked nose?', 'No. It is an aromatherapy product and does not treat any respiratory condition.'],
      ['How often can I use it?', 'Whenever you experience cravings or feel stressed: take slow, deep inhalations near each nostril. Follow the directions on the pack label.'],
    ],
  },
  {
    // From the "Tranzlife Biosciences Products" doc. Price not supplied yet:
    // price: null shows "Price to be announced" and turns off add-to-cart (see onSale below).
    id: 'breathfree-drops',
    name: 'BreathFree™ Respiratory Wellness Drops',
    short: 'BreathFree Drops',
    tagline: 'Natural respiratory support in a refreshing mint drop',
    format: 'Liquid Drops',
    size: '30 ml',
    price: null,
    mrp: null,
    badge: 'Coming soon',
    accent: '#1a6f86',
    tint: '#e5f1f4',
    concerns: ['respiratory'],
    images: ['/img/p/breathfree-drops.jpg'],
    brochure: null,
    highlights: ['Peppermint, Pudina & Tulsi', 'Caffeine & gluten free', 'No artificial colours or preservatives', '30 ml (1 fl oz)'],
    summary:
      'Respiratory wellness drops with natural botanical actives such as Peppermint, Pudina, Tulsi and Ginger, for a refreshing, cooling and soothing breathing experience.',
    description: [
      'A few drops under the tongue or in a little water bring a refreshing mint sensation and a soothing, cooling respiratory experience that helps you feel refreshed and active.',
      'BreathFree™ Drops combine Peppermint, Pudina (Indian mint), Tulsi, Ginger and Spearmint in a coconut-derived MCT base, lightly sweetened with Stevia. Scientifically formulated, vegetarian, caffeine free and gluten free, with no artificial colours or preservatives.',
    ],
    benefits: [
      'Supports clear breathing',
      'Promotes respiratory comfort',
      'Provides a refreshing mint sensation',
      'Supports a soothing and cooling respiratory experience',
      'Helps you feel refreshed and active',
    ],
    ingredients: ['peppermint-leaf', 'pudina', 'tulsi', 'ginger', 'spearmint', 'mct', 'stevia'],
    routine: [
      { label: 'Dose', value: '10–15 drops (about 0.5 ml)' },
      { label: 'How', value: 'Under the tongue or in water' },
      { label: 'When', value: '1–2 times daily' },
    ],
    howToUse: [
      'Take 10–15 drops (approximately 0.5 ml) directly under the tongue or in a small amount of water.',
      'Use 1–2 times daily.',
      'Or use as advised by a healthcare professional.',
    ],
    whoFor: [
      'Adults who want everyday respiratory wellness support',
      'People living in polluted or dusty cities',
      'Anyone who likes a refreshing, cooling mint lift during the day',
    ],
    precautions: [
      'Use as directed. Do not exceed the recommended serving.',
      'Pregnant, breastfeeding, taking medication or managing a medical condition? Consult a healthcare professional before use.',
      'Not a substitute for prescribed respiratory medicines or medical care.',
      'Store in a cool, dry place away from direct sunlight. Keep out of reach of children.',
    ],
    faqs: [
      ['What are BreathFree™ Drops?', 'Respiratory wellness drops made with natural botanical actives, positioned for natural respiratory support.'],
      ['What is inside?', 'Peppermint (Mentha piperita), Pudina / Indian Mint (Mentha arvensis), Tulsi (Ocimum tenuiflorum), Ginger (Zingiber officinale), Spearmint (Mentha spicata), MCT (coconut-derived) and Stevia (Stevia rebaudiana).'],
      ['How do I take them?', 'Take 10–15 drops (about 0.5 ml) directly under the tongue or in a small amount of water, 1–2 times daily, or as advised by a healthcare professional.'],
      ['Are they vegetarian?', 'Yes. They are vegetarian, caffeine free and gluten free, with no artificial colours or preservatives.'],
      ['What is the shelf life?', '24 months. Store in a cool, dry place away from direct sunlight.'],
      ['When can I buy them?', 'BreathFree™ Drops are coming soon. Tap “Notify me on WhatsApp” and our team will let you know when they are available.'],
    ],
  },
];

export const getProduct = (id) => PRODUCTS.find((p) => p.id === id);
/** Products without a confirmed price are shown but cannot be added to the cart yet. */
export const hasPrice = (p) => Number.isFinite(p?.price) && p.price > 0;
export const onSale = hasPrice;

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
  if (!Array.isArray(list)) return;   // an empty list is real: the database has no products, so the shop shows none
  PRODUCTS.splice(0, PRODUCTS.length, ...list);
  FORMATS.splice(0, FORMATS.length, ...new Set(list.map((p) => p.format).filter(Boolean)));
  version += 1;
  listeners.forEach((fn) => fn(version));
}
