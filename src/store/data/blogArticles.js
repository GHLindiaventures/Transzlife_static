// SEED DATA ONLY (see the note at the top of articles.js): imported once into the blog CMS, not read by the website.
// Blog articles from the content team ("Tranzlife Blogs" doc, Nov 2026).
// Same shape as ARTICLES in articles.js, plus richer bodies:
//   intro     blocks shown before the first heading
//   sections  [heading, body]; body is a string or an array of blocks:
//             'text with **bold**'  |  { ul: [...] }  |  { ol: [...] }  |  { table: [[head...], [row...], ...] }
//             { callout: 'text' }   |  { faq: [[question, answer], ...] }
//   cta       closing product line: { text, label, to }
//   disclaimer replaces the default "not medical advice" note
// Edits from the doc: product names/ingredients corrected to the product doc
// (BreatheFree, not "Craving Control"; PulmoClear has no giloy), and the Rasayana Elite
// line points to an on-sale product instead.

import { photo } from './photos.js';

// figures: [{ after: section index, src, alt, caption }] are shown after that section.
const fig = (after, key, alt, caption) => ({ after, src: photo(key, 1200), alt, caption });

export const BLOG_ARTICLES = [
  {
    id: 'quit-smoking-naturally-herbal-ayurvedic',
    title: 'How to Quit Smoking Naturally: 7 Herbal and Ayurvedic Approaches',
    excerpt: 'Nicotine creates dependence and daily rituals create triggers. Seven herbal and Ayurvedic approaches that support your quit journey, with an honest note on what each can and can’t do.',
    category: 'Quit Smoking',
    concern: 'quit-smoking',
    readTime: '6 min read',
    date: '2026-11-25',
    image: photo('quitFlower', 1200),
    figures: [
      fig(1, 'tulsiTea', 'A bowl of tulsi tea among fresh leaves', 'Tulsi tea makes an easy swap for a cigarette break.'),
      fig(5, 'oilBottles', 'Small brown bottles of essential oils', 'Peppermint, eucalyptus, lavender, lemon and black pepper are common aromatherapy oils.'),
      fig(6, 'meditateFloor', 'A woman practising slow breathing, sitting cross-legged', 'A few minutes of pranayama calms the mind when cravings build.'),
    ],
    intro: [
      'Quitting smoking is hard because it is both a physical and a mental habit. Nicotine creates dependence, and the daily rituals around smoking (the morning tea, the work break, the stressful moment) create strong triggers.',
      'Many people look for **natural ways to quit smoking** alongside willpower, and Ayurveda and herbal traditions offer several supportive options. Here are seven approaches, with an honest note on what each can and can’t do.',
      { callout: '**Important:** Natural approaches support your quit journey. They are not a replacement for medical advice. If you are a heavy smoker or have a health condition, speak to your doctor about the best plan for you.' },
    ],
    sections: [
      ['1. Understand Your Cravings First', [
        'Before reaching for any remedy, know what you’re dealing with. Nicotine cravings usually peak within the first few days and ease over the following weeks. Most cravings last only a few minutes.',
        'Keep a simple log for a week. Note when you smoke, what you were doing and how you felt. Most people find 3 to 4 predictable triggers, and that is where your plan should focus.',
      ]],
      ['2. Tulsi (Holy Basil) for Stress and Respiratory Comfort', [
        'Tulsi has been used in Ayurveda for centuries for respiratory wellness and as an adaptogen, meaning it is traditionally used to help the body cope with stress. Stress is one of the biggest relapse triggers, so many people drink tulsi tea in place of a cigarette break.',
        '**How to use:** steep fresh tulsi leaves in hot water for 5 to 7 minutes, with a little honey if you like.',
      ]],
      ['3. Ashwagandha for Stress and Irritability', [
        'Irritability and restlessness are common in the first weeks after quitting. Ashwagandha is one of the best-known adaptogenic herbs in Ayurveda, and some studies suggest it may help reduce stress and anxiety. Research on it specifically for smoking cessation is limited, so think of it as stress support rather than a cure for cravings.',
        '**Caution:** speak to a doctor first if you are pregnant, have a thyroid condition or take regular medication.',
      ]],
      ['4. Mulethi (Licorice Root) for a Soothed Throat', [
        'Mulethi is traditionally used for throat comfort and cough. Many people chew a small piece of licorice root as an oral substitute, which keeps the mouth busy when the hand-to-mouth habit kicks in.',
        '**Caution:** avoid it if you have high blood pressure, and don’t use it long-term without medical advice.',
      ]],
      ['5. Vasaka and Pippali for Lung Support', [
        'Vasaka (Adhatoda vasica) and pippali (long pepper) are classic Ayurvedic herbs for respiratory wellness. They are traditionally used to support the lungs and ease congestion as the body adjusts after smoking.',
        'These herbs are commonly combined in formulations designed for **lung detox support**. Look for products with clearly listed ingredients, quality certifications such as GMP, and no hidden nicotine or additives.',
      ]],
      ['6. Aromatherapy: Essential Oils for Cravings', [
        'Inhaling certain aromas can give your senses something to focus on when a craving hits. Peppermint, eucalyptus, lavender, lemon and black pepper oils are the most common choices. Small studies suggest that inhaling black pepper vapor may reduce the urge to smoke, though larger studies are needed.',
        'An **aromatherapy inhaler** is a discreet option because it is portable, nicotine-free and can be used anywhere, including at work or while travelling. Typical use is a slow inhale through each nostril whenever a craving starts.',
      ]],
      ['7. Lifestyle Habits That Make Everything Work Better', [
        'Herbs help most when paired with daily habits:',
        { ul: [
          '**Pranayama:** slow breathing such as anulom vilom or deep diaphragmatic breathing calms the mind and builds lung capacity.',
          '**Exercise:** even a 15-minute walk reduces craving intensity.',
          '**Hydration:** water helps flush out toxins and keeps your mouth busy.',
          '**Swap the ritual:** replace the cigarette break with tea, a short walk or a call to a friend.',
          '**Sleep:** poor sleep makes cravings stronger, so aim for 7 to 8 hours.',
          '**Support:** tell family or friends. Quitting is easier with accountability.',
        ] },
      ]],
      ['A Simple 4-Week Plan', [
        { table: [
          ['Week', 'Focus'],
          ['Week 1', 'Identify triggers, control cravings with herbal teas and an inhaler'],
          ['Week 2', 'Cut cigarettes sharply, add pranayama and daily walks'],
          ['Week 3', 'Build new habits, support lungs with herbs and hydration'],
          ['Week 4', 'Stay smoke-free, plan for high-risk situations'],
        ] },
      ]],
      ['When to Seek Professional Help', 'Natural approaches work well for many people, but some need more support. Talk to a doctor if you smoke heavily, have tried to quit several times, or have a condition such as asthma, COPD or heart disease. Nicotine replacement therapy and counselling have strong evidence behind them and can be combined with natural support.'],
      ['Frequently Asked Questions', [
        { faq: [
          ['Can I really quit smoking naturally?', 'Yes, many people do. Success is highest when you combine a clear plan, stress management, healthy substitutes and support from people around you.'],
          ['Which herb is best for quitting smoking?', 'No single herb is a proven fix. Tulsi, ashwagandha, mulethi, vasaka and pippali are commonly used as supportive herbs for stress and respiratory comfort.'],
          ['How long do smoking cravings last?', 'Individual cravings usually pass in a few minutes. Overall intensity generally eases over the first few weeks.'],
          ['Do aromatherapy inhalers contain nicotine?', 'Good ones don’t. Check the label to confirm the product is nicotine-free and made from essential oils.'],
          ['Is lung detox after quitting real?', 'Your lungs begin repairing themselves once you stop smoking. Supportive herbs, hydration, exercise and breathing practices may help that process, but the biggest benefit comes from staying smoke-free.'],
        ] },
      ]],
      ['Final Thoughts', 'Quitting smoking is one of the best things you can do for your health. Combine herbal and Ayurvedic support with smart habits and a clear plan, and you give yourself a much better chance of staying smoke-free.'],
    ],
    cta: {
      text: '**Looking for support on your journey?** Explore TranzLife’s nicotine-free BreatheFree™ aromatherapy inhaler and PulmoClear™ lung support gummies, made with natural ingredients.',
      label: 'Explore BreatheFree™',
      to: '/products/breathefree-inhaler',
    },
    disclaimer: 'This article is for general information only and is not medical advice. These products are nutraceuticals and are not intended to diagnose, treat, cure or prevent any disease. Consult a qualified healthcare professional before starting any new supplement.',
  },
  {
    id: 'indian-foods-that-boost-immunity',
    title: '10 Indian Foods That Naturally Boost Immunity',
    excerpt: 'You don’t need exotic ingredients. Ten everyday foods from the Indian kitchen, used for generations to support the body’s natural defences, plus a sample immunity-friendly day.',
    category: 'Immunity & Nutrition',
    concern: 'respiratory',
    readTime: '6 min read',
    date: '2026-11-24',
    image: photo('spices', 1200),
    figures: [
      fig(1, 'turmericRoot', 'Fresh turmeric root, dried pieces and turmeric powder', 'Turmeric, best paired with a pinch of black pepper.'),
      fig(7, 'oranges', 'A pile of fresh oranges', 'Citrus fruits are an easy daily source of vitamin C.'),
      fig(9, 'spinach', 'Fresh spinach leaves', 'Leafy greens add vitamins, minerals and fibre.'),
    ],
    intro: [
      'Your immune system works all year, but it needs extra care when seasons change, stress piles up or you’re not sleeping well. The good news is that you don’t need exotic ingredients. Many of the best **foods that boost immunity** are already in an Indian kitchen.',
      'Here are 10 everyday foods that have been used for generations in Indian households and in Ayurveda to support the body’s natural defences.',
      { callout: '**Quick note:** No single food prevents illness. Immunity is shaped by your overall diet, sleep, activity and stress levels. These foods are best seen as part of a balanced lifestyle.' },
    ],
    sections: [
      ['1. Amla (Indian Gooseberry)', [
        'Amla is one of the richest natural sources of vitamin C, a nutrient your body uses to support normal immune function. It is also valued in Ayurveda as a rejuvenating fruit.',
        '**How to eat it:** raw with a pinch of salt, as juice, in chutney, or as murabba.',
      ]],
      ['2. Turmeric', [
        'Turmeric contains curcumin, a compound studied for its antioxidant properties. In Indian homes it appears in everything from dal to the traditional haldi doodh (golden milk).',
        '**How to eat it:** in daily cooking, or stirred into warm milk at night.',
      ]],
      ['3. Black Pepper', [
        'Black pepper contains piperine, which has been studied for improving how well the body absorbs curcumin from turmeric. That is why the two are often used together in traditional recipes and in many modern formulations.',
        '**How to eat it:** a pinch in your turmeric milk, soups or tea.',
      ]],
      ['4. Ginger', [
        'Ginger is a kitchen staple for cold-season comfort. It is traditionally used to soothe the throat and aid digestion, and it adds warmth to tea and food.',
        '**How to eat it:** grated in tea, in kadha, or fresh with honey.',
      ]],
      ['5. Garlic', [
        'Garlic contains sulfur compounds such as allicin, which are of interest in nutrition research. It has long been used in home remedies for seasonal wellness.',
        '**How to eat it:** crushed and left for a few minutes before cooking, which helps preserve its beneficial compounds.',
      ]],
      ['6. Tulsi (Holy Basil)', [
        'Tulsi is considered sacred in India and is widely used in Ayurveda. It is traditionally taken for respiratory comfort and as an adaptogen to help the body manage stress.',
        '**How to eat it:** as tulsi tea, or a few leaves in your kadha.',
      ]],
      ['7. Curd and Fermented Foods', [
        'A large share of your immune system is linked to gut health. Curd, buttermilk and fermented foods like idli and dosa batter supply probiotics that support a healthy gut.',
        '**How to eat it:** a bowl of fresh curd with lunch, or a glass of spiced chaas.',
      ]],
      ['8. Citrus Fruits', [
        'Oranges, mosambi, lemons and kinnow are easy sources of vitamin C. Because your body does not store vitamin C, it helps to include some every day.',
        '**How to eat it:** whole fruit rather than only juice, so you also get the fibre.',
      ]],
      ['9. Nuts and Seeds', [
        'Almonds, walnuts, sunflower seeds and pumpkin seeds provide vitamin E, zinc and healthy fats, all of which play a role in normal immune function.',
        '**How to eat it:** a small handful as a mid-morning snack.',
      ]],
      ['10. Green Leafy Vegetables', [
        'Spinach, methi, amaranth (thotakura) and drumstick leaves are rich in vitamins, minerals and antioxidants. They also add fibre, which feeds healthy gut bacteria.',
        '**How to eat it:** in dal, parathas or simple sabzi.',
      ]],
      ['A Sample Immunity-Friendly Day', [
        { table: [
          ['Meal', 'Idea'],
          ['Morning', 'Warm water with lemon, and a small piece of amla'],
          ['Breakfast', 'Vegetable poha or idli with sambar'],
          ['Mid-morning', 'Handful of nuts and a citrus fruit'],
          ['Lunch', 'Dal, roti, a green sabzi and fresh curd'],
          ['Evening', 'Tulsi-ginger tea'],
          ['Dinner', 'Light khichdi with ghee and turmeric milk before bed'],
        ] },
      ]],
      ['Beyond Food: Habits That Support Immunity', [
        'Food is only one part of the picture. These habits matter just as much:',
        { ul: [
          '**Sleep:** aim for 7 to 8 hours, since poor sleep is linked to weaker immune responses.',
          '**Movement:** regular moderate exercise, even a daily walk, supports overall health.',
          '**Stress management:** try pranayama, meditation or time outdoors.',
          '**Hydration:** drink enough water through the day.',
          '**Limit processed food and sugar:** these can crowd out nutrient-rich foods.',
        ] },
      ]],
      ['What About Supplements?', [
        'Food should always come first. But busy schedules, travel or a limited diet can make it hard to get consistent nutrition. In those cases, some people choose supplements that combine traditional ingredients such as amla, ashwagandha, guduchi and turmeric with piperine, to support their daily routine.',
        'If you do consider a supplement, look for clear ingredient lists, quality certifications such as GMP, and transparent labelling. Speak to your doctor first if you are pregnant, take regular medication or have a medical condition.',
      ]],
      ['Frequently Asked Questions', [
        { faq: [
          ['Which food is best for boosting immunity?', 'No single food does it all. Amla, turmeric, ginger, tulsi and citrus fruits are popular choices, but variety across your diet matters most.'],
          ['Can I boost my immunity quickly?', 'Immunity is built through consistent habits over time, not overnight. Regular sleep, balanced meals and low stress make the biggest difference.'],
          ['Are Ayurvedic immunity boosters safe?', 'Most culinary herbs and spices are safe in normal food amounts. Concentrated supplements are different, so check with a doctor if you have a health condition or take medication.'],
          ['Which foods help with immunity in winter and monsoon?', 'Warm, freshly cooked foods like ginger tea, turmeric milk, soups and tulsi kadha are traditional favourites during colder and wetter months.'],
          ['Does vitamin C prevent colds?', 'Vitamin C supports normal immune function, but it does not guarantee you won’t get a cold. It is one piece of a healthy lifestyle.'],
        ] },
      ]],
      ['Final Thoughts', 'Building stronger immunity does not need complicated diets. Start by adding two or three of these foods to your week, then build from there. Small, steady choices add up.'],
    ],
    cta: {
      text: '**Looking for daily support alongside a healthy diet?** Explore TranzLife PulmoClear™ Gummies, which combine Ayurvedic botanicals such as tulsi, vasaka and dry ginger with Vitamin C, Vitamin D3 and Zinc.',
      label: 'Explore PulmoClear™',
      to: '/products/pulmoclear-gummies',
    },
    disclaimer: 'This article is for general information only and is not medical advice. Supplements are not intended to diagnose, treat, cure or prevent any disease. Consult a qualified healthcare professional before making changes to your diet or starting any supplement.',
  },
  {
    id: 'does-liver-detox-work-myths-vs-facts',
    title: 'Does Liver Detox Really Work? Myths vs. Facts',
    excerpt: 'Juice cleanses, detox teas and quick-fix kits promise to flush out toxins in days. Your liver already detoxifies your body every day. Here is what’s myth, what’s fact, and what actually helps.',
    category: 'Liver & Digestion',
    concern: 'liver',
    readTime: '6 min read',
    date: '2026-11-23',
    image: photo('greenJuice', 1200),
    figures: [
      fig(2, 'mortar', 'Herbs being ground in a mortar and pestle', 'Classical liver herbs include bhumyamalaki, kalmegh and kutki.'),
      fig(3, 'sunsetWalk', 'A person walking on a path at sunset', 'Daily movement does more for your liver than any cleanse.'),
      fig(4, 'leafyGreens', 'Green leafy vegetables', 'Leafy greens bring fibre, vitamins and antioxidants.'),
    ],
    intro: [
      'Search for “liver detox” and you’ll find juice cleanses, teas and quick-fix kits that promise to flush out toxins in days. It sounds appealing, but does any of it work?',
      'The honest answer is more nuanced. Your liver already detoxifies your body every day, so the real question is how to support it. Here is what’s myth, what’s fact, and what you can actually do.',
      { callout: '**Quick answer:** Your liver cleans itself. Short “detox” plans don’t have strong scientific backing, but healthy habits and some traditional herbs may support liver health over time.' },
    ],
    sections: [
      ['What Does Your Liver Actually Do?', [
        'The liver is one of the hardest-working organs in your body. It processes nutrients from food, breaks down alcohol and medicines, makes bile for digestion, and stores energy. In simple terms, it is your body’s built-in filtration system.',
        'That is why most doctors say a healthy liver doesn’t need a special cleanse. It needs fewer things that stress it, and more things that support it.',
      ]],
      ['Liver Detox: 6 Myths vs. Facts', [
        { faq: [
          ['Myth 1: A 3-day juice cleanse resets your liver.', '**Fact:** There is no strong evidence that juice cleanses improve liver function. A very restrictive diet can leave you tired and short of nutrients.'],
          ['Myth 2: Detox teas and kits flush out toxins.', '**Fact:** Your liver and kidneys do that job. Some “detox” products are mostly laxatives or diuretics, which only change what leaves your body.'],
          ['Myth 3: Herbal means completely safe.', '**Fact:** Natural doesn’t always mean harmless. Some herbal products have been linked to liver injury, especially in high doses or poorly made products. Quality and dose matter.'],
          ['Myth 4: Only heavy drinkers get liver problems.', '**Fact:** Fatty liver can develop without alcohol, and it is increasingly common in India, linked to diet, weight and lack of exercise. Studies suggest it may affect roughly one in three adults.'],
          ['Myth 5: You’d feel it if something was wrong with your liver.', '**Fact:** Early liver problems often have no symptoms. Regular check-ups matter, especially if you have diabetes, high cholesterol or a family history.'],
          ['Myth 6: Supplements can undo an unhealthy lifestyle.', '**Fact:** No supplement cancels out heavy drinking, a poor diet or inactivity. Supplements, if used, are an addition to healthy habits and not a replacement.'],
        ] },
      ]],
      ['Ayurvedic Herbs Traditionally Used for Liver Wellness', [
        'Ayurveda has a long tradition of herbs used to support the liver, known as *yakrit* in classical texts. Three of the best known are:',
        { ul: [
          '**Bhumyamalaki (Phyllanthus niruri):** traditionally used for liver and digestive wellness, and widely studied for its antioxidant properties.',
          '**Kalmegh (Andrographis paniculata):** known as the “king of bitters”, traditionally used for liver comfort and general wellness.',
          '**Kutki (Picrorhiza kurroa):** a bitter Himalayan herb traditionally used to support liver function and digestion.',
        ] },
        'Others you will see in classical formulations include guduchi, punarnava, bhringraj, amla and turmeric.',
        'Research on many of these herbs is still limited and often early-stage, so they should be seen as traditional support and not proven treatments. Always buy from brands that clearly list ingredients and follow quality standards.',
      ]],
      ['8 Daily Habits That Actually Support Your Liver', [
        'This is where the evidence is strongest:',
        { ol: [
          '**Limit or avoid alcohol.** It is one of the biggest causes of liver damage.',
          '**Maintain a healthy weight.** Excess weight is a leading driver of fatty liver.',
          '**Eat more whole foods.** Vegetables, fruit, whole grains, dal and nuts are good choices.',
          '**Cut back on sugar and fried food.** Sugary drinks and processed snacks add to liver fat.',
          '**Stay active.** Aim for around 30 minutes of movement most days.',
          '**Be careful with medicines.** Take painkillers such as paracetamol only at recommended doses, and don’t mix medicines without advice.',
          '**Get vaccinated.** Hepatitis A and B vaccines protect the liver from infection.',
          '**Drink enough water, and enjoy coffee in moderation.** Some studies link moderate coffee intake with lower liver disease risk.',
        ] },
      ]],
      ['Foods That Support Liver Health', [
        { table: [
          ['Food', 'Why it helps'],
          ['Leafy greens (spinach, methi)', 'Fibre, vitamins and antioxidants'],
          ['Turmeric', 'Contains curcumin, studied for antioxidant properties'],
          ['Amla', 'Rich in vitamin C'],
          ['Garlic', 'Contains sulfur compounds of research interest'],
          ['Beetroot', 'Natural nitrates and antioxidants'],
          ['Nuts and seeds', 'Healthy fats and vitamin E'],
          ['Papaya and citrus', 'Vitamins and fibre'],
        ] },
      ]],
      ['Signs You Should See a Doctor', 'Don’t rely on home remedies if you notice any of these: yellowing of the eyes or skin, persistent fatigue, dark urine, pale stools, swelling in the abdomen or legs, ongoing nausea, or pain in the upper right abdomen. Anyone with diabetes, obesity, high cholesterol or a family history of liver disease should have regular liver function tests.'],
      ['Where Herbal Liver Support Fits In', 'If you are already eating well, staying active and limiting alcohol, some people choose to add a traditional polyherbal formulation to their routine. If you do, look for a licensed product with a clear ingredient list, GMP certification and honest labelling, and talk to your doctor first if you take regular medication or have an existing liver condition.'],
      ['Frequently Asked Questions', [
        { faq: [
          ['Does liver detox really work?', 'Your liver detoxifies on its own. Short cleanses and detox kits lack strong evidence, but healthy habits and a balanced diet support liver function.'],
          ['What is the best natural way to support the liver?', 'The best-supported steps are limiting alcohol, keeping a healthy weight, eating whole foods and staying active.'],
          ['Are bhumyamalaki, kalmegh and kutki safe?', 'They are used traditionally, but safety depends on dose, quality and your health. Speak to a doctor before use if you are pregnant, take medication or have liver disease.'],
          ['What are early signs of an unhealthy liver?', 'Often there are none. When symptoms do appear, they can include fatigue, nausea, yellowing of the eyes and abdominal discomfort, so regular check-ups are important.'],
          ['How often should I get my liver checked?', 'If you have risk factors such as diabetes, obesity, high cholesterol or heavy alcohol use, ask your doctor about annual liver function tests.'],
        ] },
      ]],
      ['Final Thoughts', 'There is no shortcut to a healthy liver, and no need to fear it either. Consistent habits do far more than any cleanse. Start with small changes, such as cutting sugary drinks, walking daily and reducing alcohol, and let any herbal support sit on top of that foundation.'],
    ],
    cta: {
      text: '**Looking for traditional herbal support alongside a healthy lifestyle?** Explore TranzLife Liver Booster (LiverDetox), a polyherbal Ayurvedic formulation with bhumyamalaki, kalmegh, kutki, guduchi, punarnava and more.',
      label: 'Explore Liver Booster',
      to: '/products/liver-booster',
    },
    disclaimer: 'This article is for general information only and is not medical advice. It is not a substitute for professional diagnosis or treatment. Consult a qualified healthcare professional before starting any herbal product, especially if you have a liver condition or take regular medication.',
  },
  {
    id: 'period-cramps-natural-relief',
    title: 'Period Cramps? 8 Natural Ways to Find Relief',
    excerpt: 'Period pain is one of the most common reasons women miss work, school and plans. Eight natural approaches many women find helpful, and an honest note on when to see a doctor.',
    category: 'Menstrual Comfort',
    concern: 'menstrual',
    readTime: '6 min read',
    date: '2026-11-22',
    image: photo('stomachPain', 1200),
    figures: [
      fig(1, 'kettleBottle', 'Hot water being poured into a bottle', 'Warmth on the lower abdomen for 15 to 20 minutes can take the edge off.'),
      fig(2, 'childPose', 'A woman resting in child’s pose on a yoga mat', 'Child’s pose is a gentle favourite on period days.'),
      fig(3, 'gingerTea', 'A cup of tea with ginger and lemon', 'Warm ginger tea with a little honey.'),
    ],
    intro: [
      'It’s day one. You’re at your desk, trying to look normal, while your lower abdomen feels like it’s being wrung out like a wet towel. You’ve already had two cups of tea, shifted in your chair five times, and mentally cancelled your evening plans.',
      'If that sounds familiar, you’re far from alone. Period pain is one of the most common reasons women miss work, school and plans, and yet it’s often brushed off with “it’s just part of being a woman.”',
      'It doesn’t have to be something you simply put up with. Here are eight natural approaches that many women find helpful, along with an honest note on when to see a doctor.',
    ],
    sections: [
      ['Why do cramps happen?', [
        'During your period, the uterus contracts to shed its lining. Hormone-like substances called prostaglandins trigger those contractions, and higher levels are linked with stronger cramps. That’s why pain often peaks on the first or second day and then fades.',
        'Mild to moderate cramping is common. Pain that stops you from living your life is not something to ignore, and we’ll come back to that.',
      ]],
      ['1. Start with warmth', 'This is the oldest trick, and it genuinely works for many people. Heat relaxes the muscles of the lower abdomen and increases comfort. A hot water bag, a warm towel or a heating pad on your belly for 15 to 20 minutes can take the edge off. A warm bath does the same job if you have the time.'],
      ['2. Move, even when you don’t want to', 'Exercise is the last thing you feel like doing with cramps, but gentle movement helps. A slow 20-minute walk or a few easy yoga poses can ease tension. Child’s pose, cat-cow and a supported forward bend are favourites. Skip anything intense if it hurts. The goal is to loosen up, not to push.'],
      ['3. Sip something warm', 'Ginger tea is a household remedy for good reason, and some small studies suggest ginger may help with period pain. Chamomile and fennel (saunf) tea are also traditional choices for relaxation and comfort. Keep it simple: a mug of warm water with fresh ginger and a little honey can be soothing.'],
      ['4. Be kind to your plate', [
        'What you eat in the days before and during your period can affect how you feel. Many women feel better with:',
        { ul: [
          'More **iron-rich foods** like spinach, dates, jaggery and lentils, to replace what’s lost',
          '**Magnesium-rich foods** like nuts, seeds and bananas',
          '**Plenty of water**, since dehydration can make cramps feel worse',
        ] },
        'And if you notice that very salty snacks, heavy fried food, or too much caffeine make things worse for you, ease off for a few days. Everyone’s body reacts a little differently.',
      ]],
      ['5. Try aromatherapy and gentle massage', [
        'Massaging the lower abdomen in slow circular motions, with a diluted essential oil blend, is a traditional comfort ritual. Lavender is commonly used for relaxation, and a few small studies have looked at aromatherapy massage for period pain with encouraging early results, though more research is needed.',
        'A roll-on is a handy way to do this, because it’s mess-free and you can carry it in your bag. **Always check the label, do a patch test first, and never apply essential oils to broken skin.**',
      ]],
      ['6. Rest and sleep like it matters', 'Tiredness and pain feed each other. If you can, take it easy on day one or two, go to bed earlier, and give yourself permission to do less. Poor sleep makes pain feel sharper, so this one is worth protecting.'],
      ['7. Breathe through it', 'Slow, deep breathing might sound too simple, but it works by calming your nervous system, and a calmer body often feels less pain. Try breathing in for four counts, out for six, for five minutes. Many women pair this with lying on their back with knees bent and a warm compress on the belly.'],
      ['8. Think about the long game', 'If cramps return every month, small habits across the whole month matter more than any one-off fix. Regular exercise, balanced meals, managing stress and getting enough sleep are linked with less severe period symptoms for many women. Track your cycle in an app or a notebook for two or three months. You may spot patterns, such as certain foods or stressful weeks that make it worse.'],
      ['When cramps are not “normal”', [
        'Natural remedies are for ordinary period discomfort. Please see a doctor if:',
        { ul: [
          'Pain is severe enough to stop you doing daily activities',
          'Pain is getting worse over time',
          'Your bleeding is very heavy, or you pass large clots',
          'You have pain between periods, or during sex',
          'Over-the-counter pain relief doesn’t help',
        ] },
        'Conditions like endometriosis, fibroids and adenomyosis can cause severe period pain and often go undiagnosed for years. Getting checked isn’t overreacting. It’s looking after yourself.',
      ]],
      ['Quick answers', [
        { faq: [
          ['What helps period cramps fastest?', 'Heat is usually the quickest and simplest, and many women combine it with a warm drink and gentle movement.'],
          ['Are essential oils safe during periods?', 'Diluted oils applied to the skin are generally fine for most people, but always patch test first and avoid them if you’re pregnant or have sensitive skin. Don’t swallow essential oils.'],
          ['What should I avoid eating during periods?', 'There’s no strict list. Some women feel worse with very salty, sugary, fried or caffeinated foods, so notice what affects you personally.'],
          ['Is exercise good for period pain?', 'Gentle exercise such as walking and yoga often helps. Rest is fine too if that’s what your body needs.'],
          ['Can period cramps be a sign of something serious?', 'Usually not, but severe, worsening or unusual pain should be checked by a doctor.'],
        ] },
      ]],
      ['One last thing', 'You don’t need to be tough about period pain. Try a few of these, see what works for your body, and build your own small ritual: a warm drink, a heat pack, a few minutes of breathing, a gentle roll-on massage.'],
    ],
    cta: {
      text: 'If you’re looking for a plant-based, non-greasy roll-on for your routine, TranzLife’s **CycleRelief™** is made for menstrual comfort and wellbeing. It’s for external use only.',
      label: 'Explore CycleRelief™',
      to: '/products/cyclerelief-roll-on',
    },
    disclaimer: 'This article is for general information only and is not medical advice. Consult a doctor if you have severe, unusual or worsening period pain.',
  },
  {
    id: 'detox-lungs-naturally-after-smoking',
    title: 'How to Detox Your Lungs Naturally After Smoking',
    excerpt: 'Your lungs don’t need a magic cleanse. They already know how to heal. What happens after your last cigarette, and the habits that actually help your lungs recover.',
    category: 'Lungs & Breathing',
    concern: 'respiratory',
    readTime: '6 min read',
    date: '2026-11-21',
    image: photo('forestBreath', 1200),
    figures: [
      fig(2, 'forestPath', 'A man walking on a forest path', 'A daily walk helps your lungs and heart adapt.'),
      fig(3, 'herbalMug', 'A glass mug of herbal tea with green leaves', 'A simple tulsi-ginger kadha is a popular home remedy.'),
    ],
    intro: [
      'You’ve had your last cigarette. Congratulations, that was the hard part.',
      'Now you’re probably wondering: how do I clean my lungs? Search online and you’ll find teas, juices, powders and “7-day lung cleanses”. Here’s the honest version: **your lungs don’t need a magic cleanse. They already know how to heal. Your job is to give them the right conditions.**',
      'Let’s look at what’s actually happening in your body, and what you can do to help it along.',
    ],
    sections: [
      ['What happens after your last cigarette', [
        'Recovery starts faster than most people expect. Based on commonly cited public health data (from sources like the CDC and American Cancer Society):',
        { ul: [
          '**20 minutes:** your heart rate and blood pressure begin to come down.',
          '**12 hours:** carbon monoxide in your blood drops back toward normal, so your blood carries oxygen better.',
          '**2 to 12 weeks:** circulation improves and lung function begins to increase. Walking and climbing stairs often feel easier.',
          '**1 to 9 months:** coughing and shortness of breath decrease as the tiny hair-like cilia in your airways start to regrow and work again. These cilia sweep mucus and dirt out of your lungs.',
          '**1 year:** your excess risk of coronary heart disease is about half that of a current smoker.',
          '**10 years:** your risk of dying from lung cancer is about half that of a person who still smokes.',
        ] },
        'Everyone’s timeline is a bit different, and long-time heavy smokers may recover more slowly or incompletely. But the direction is clear: the body responds, and it starts early.',
      ]],
      ['“Why am I coughing more since I quit?”', [
        'This is one of the most common worries, and it catches people off guard. In the first weeks, some ex-smokers cough more and bring up more phlegm than before.',
        'It’s usually a sign the cilia are waking up and doing their job again, clearing out built-up mucus. It’s frustrating but generally temporary.',
        'That said, **see a doctor if** your cough lasts more than three weeks, you cough up blood, or you have chest pain, wheezing or breathlessness at rest. Don’t assume it’s “just detox”.',
      ]],
      ['What actually helps your lungs recover', [
        'These are the habits with the most backing, in order of importance.',
        { ol: [
          '**Stay smoke-free, including vaping and secondhand smoke.** Nothing else on this list matters if you go back to smoking. Avoid smoky rooms too, and be careful about “just one”.',
          '**Walk every day.** Even 20 to 30 minutes helps your lungs and heart adapt. Start slowly, and build up as your breathing improves.',
          '**Practise pranayama.** Slow breathing exercises such as anulom vilom, bhramari and deep belly breathing train your breathing muscles and build awareness of your breath. Five to ten minutes each morning is plenty to start with.',
          '**Drink enough water.** Staying hydrated helps keep mucus thinner and easier to clear.',
          '**Try warm steam, carefully.** A few minutes of warm (not scalding) steam can bring short-term comfort with congestion. It doesn’t clean your lungs, so think of it as comfort only.',
          '**Protect your lungs from pollution.** Check the air quality index, avoid exercising outdoors on very bad days, and consider a well-fitted mask in heavy traffic.',
          '**Eat for recovery.** Smoking depletes antioxidants like vitamin C, so fill your plate with fruit, vegetables, nuts and whole grains. Amla, citrus fruits, leafy greens, turmeric and ginger are easy Indian staples.',
          '**Get your vaccines.** Ex-smokers can be more prone to chest infections, so ask your doctor about flu and pneumonia vaccines.',
        ] },
      ]],
      ['Where Ayurvedic herbs fit in', [
        'Ayurveda has a long tradition of herbs for respiratory wellness. Commonly used ones include **vasaka, tulsi, mulethi (licorice), turmeric and ginger**. A popular home remedy is a simple tulsi-ginger kadha with a pinch of black pepper.',
        'The honest take: these herbs are traditionally used for comfort and general respiratory wellness, and research on them is still limited. They can be a supportive part of your routine, but they don’t remove tar or reverse damage, and they’re no substitute for quitting, exercise or medical care.',
        'If you’re considering a supplement, look for clear ingredient lists, quality certifications like GMP, and honest labelling. Talk to your doctor first if you take regular medication, are pregnant, or have a lung condition. Mulethi in particular needs caution with high blood pressure.',
      ]],
      ['A realistic first-month routine', [
        'Here’s one way to put it together without overthinking it:',
        { ul: [
          '**Mornings:** 10 minutes of pranayama, a glass of warm water, then a tulsi-ginger tea.',
          '**Daytime:** a fruit or two, plenty of water, and a short walk after lunch.',
          '**Evenings:** a longer walk, a light dinner, and turmeric milk if you like it.',
          '**Cravings:** when one hits, breathe slowly, drink water, step outside. A nicotine-free aromatherapy inhaler can also give your senses something to focus on.',
        ] },
      ]],
      ['What to expect honestly', [
        'You may notice your sense of taste and smell sharpen within days. Your energy, stamina and sleep often improve over the following weeks. Some people feel restless, irritable or hungrier at first.',
        'What you shouldn’t expect is a “clean lung” feeling overnight, or a product that promises one. Healing is gradual, and the best proof is simply time smoke-free.',
      ]],
      ['Quick answers', [
        { faq: [
          ['Can lungs fully heal after smoking?', 'Lungs can recover a lot of their function, especially if you quit early. Some damage, particularly in long-term heavy smokers, may not fully reverse, which is why quitting sooner is better.'],
          ['How long does it take to detox lungs after quitting?', 'There’s no fixed date. Many people notice easier breathing within weeks to months, and the cilia can recover over about nine months.'],
          ['What foods clean your lungs?', 'No food “cleans” lungs. But antioxidant-rich foods like citrus, amla, leafy greens, turmeric and nuts support overall recovery.'],
          ['Do lung detox supplements work?', 'There’s little strong evidence that any supplement detoxes lungs. Some herbal products may support respiratory wellness alongside healthy habits, so choose carefully and check with your doctor.'],
          ['Should I get a lung check after quitting?', 'It’s a good idea, especially after years of smoking or if you have a persistent cough or breathlessness. Ask your doctor about a lung function test.'],
        ] },
      ]],
      ['One last thing', 'Every smoke-free day is a day your lungs are healing. You don’t need to buy a cleanse. You need patience, movement, clean air, and support when cravings hit.'],
    ],
    cta: {
      text: 'If you’d like herbal support in your routine, TranzLife **PulmoClear™** gummies combine traditional ingredients like vasaka, tulsi, mulethi (licorice), dry ginger and long pepper with Vitamin C, D3 and Zinc. They’re a nutraceutical, not a medicine.',
      label: 'Explore PulmoClear™',
      to: '/products/pulmoclear-gummies',
    },
    disclaimer: 'This article is for general information only and is not medical advice. Supplements are not intended to diagnose, treat, cure or prevent any disease. If you have a persistent cough, breathlessness or chest pain, please see a doctor.',
  },
];
