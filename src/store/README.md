# Store pages

Shop (`/shop`), product pages (`/products/:id`), cart, checkout, concerns, ingredients and journal,
copied from the Tranz-Life-Vishnu-Personal project so they look and work exactly like it.

- `pages/`, `components/`, `context/`, `data/`, `utils/`, `lib/`: the store project's files. Added here: `components/pdp/` (ratings, favourite/share, compact ingredients, guidance tabs, FAQ, reviews) and `data/reviewStore.js`.
  `@/…` imports point at this folder (alias in `vite.config.js`).
- `styles/source/*.css`: the store project's stylesheets, plus `pdp-plus.css` for the additions above.
- `styles/store.css`: generated from `source/` with every rule scoped under `.tl-store`, so the
  store styles and this site's styles do not affect each other. After editing anything in `source/`, run:

  ```
  node scripts/scope-store-css.mjs "$PWD/node_modules/postcss" src/store/styles/store.css src/store/styles/source/main.css src/store/styles/source/home.css src/store/styles/source/enhance.css src/store/styles/source/mobile.css src/store/styles/source/mrange.css src/store/styles/source/pdp-plus.css
  ```
- `styles/tailwind.css`: Tailwind + shadcn/ui theme, only scanning this folder.
- `styles/host.css`: how the store sits inside this site (header height, floating widget, header cart button).
- Product prices and MRPs in `data/products.js` are the store project's placeholders.
