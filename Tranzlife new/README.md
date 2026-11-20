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
