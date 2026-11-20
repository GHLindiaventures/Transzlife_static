# Transzlife static (React)

React + Vite template: home, about, science, FAQ, blog and contact pages with empty text/image placeholders.

## Commands

```bash
npm install      # once
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Structure

```
index.html                  Vite entry
public/assets/              product photos (served as /assets/...)
src/main.jsx                React + router bootstrap
src/App.jsx                 routes
src/components/             Layout, Header, Drawer, Footer, Announcement, ui helpers
src/components/sections/    page sections (Hero, Featured, ProductSlider, Reels, Parallax, ...)
src/pages/                  Home, About, Science, Faq, Blog, Contact
src/styles/                 styles.css (global + home), pages.css (inner pages)
```

## Filling in content

- `<Slot as="h2" className="slot--rich" />` is an empty text placeholder: put your text inside it.
- `<Media className="media--fill" />` is an empty image/video placeholder: put an `<img>` or `<video>` inside it.
- Placeholder links use `<Ph>` (href="#"). Swap them for `<Link to="/page">` or real URLs.
- Remove `show-slots` from `<body>` in `index.html` to hide the dashed guide outlines.

## Golden ratio design system

All proportions come from `src/styles/golden.css` (loaded last), built on phi = 1.618:

| Part | Rule |
|---|---|
| Type scale | 16px x phi^(n/2): 12.6 / 16 / 20.4 / 25.9 / 32.9 / 41.9 / 53.3 / 67.8 / 86.2 / 109.7 (`--fs--1` ... `--fs-8`) |
| Spacing | Fibonacci: 5 / 8 / 13 / 21 / 34 / 55 / 89 / 144 (`--s-1` ... `--s-8`) |
| Radius | 8 / 13 / 21 / 34 (`--r-1` ... `--r-4`) |
| Line height | body 1.618, headings 1.236 (2/phi), display 1.1 |
| Two-column layouts | 1 : phi (38.2% : 61.8%): image + text rows, product slider, pinned scenes, contact |
| Three-column layouts | benefits side : centre : side = 1 : phi : 1, footer = 1 : 1 : 1 : phi |
| Media ratios | page banners phi^2 : 1 (about / science phi^1.5 : 1), product cards sqrt(phi) : 1, blog images phi : 1 |
| Chrome | header 89px, announcement bar 34px, page padding 34px (21px on phones) |

Change a token in `:root` of `golden.css` to re-scale the whole site.
