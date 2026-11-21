import Featured from '../components/sections/Featured.jsx';
import { Sep } from '../components/sections/Blocks.jsx';
import { PRODUCTS_PAGE } from '../content/site.js';

/** The complete range on one page ("View all" from the home slider lands here). */
export default function Products() {
  return (
    <>
      <Featured layout="grid" headline={PRODUCTS_PAGE.headline} sub={PRODUCTS_PAGE.sub} />
      <Sep />
    </>
  );
}
