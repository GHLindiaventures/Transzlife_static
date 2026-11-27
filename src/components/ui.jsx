import { forwardRef } from 'react';
import { PHOTO_ALT, PHOTO_EXT } from '../content/site.js';

/* Small building blocks shared by every page. */

/** Empty text placeholder. Fill it with your own copy: <Slot as="h2" className="slot--rich">Text</Slot> */
export function Slot({ as: Tag = 'span', className = '', children, ...rest }) {
  const filled = children !== undefined && children !== null && children !== false && children !== '';
  return (
    <Tag className={`slot ${filled ? 'has-text ' : ''}${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

/** Empty image / video placeholder. Put an <img> or <video> inside it. */
/** `photo` = file name (no extension) in /public/assets/photos, e.g. <Media photo="lavender" /> */
export const Media = forwardRef(function Media({ className = '', children, photo, ...rest }, ref) {
  return (
    <div ref={ref} className={`media ${className}`.trim()} {...rest}>
      {photo ? (
        <img
          src={`${import.meta.env.BASE_URL}assets/photos/${photo}.${PHOTO_EXT[photo] || 'jpg'}`}
          alt={PHOTO_ALT[photo] || ''}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      {children}
    </div>
  );
});

/** Placeholder links (href="#") must not jump to the top. Swap for <Link to> / real URLs. */
export const stop = (e) => e.preventDefault();

export function Ph({ children, ...rest }) {
  return (
    <a href="#" onClick={stop} {...rest}>
      {children}
    </a>
  );
}

/** Product packshot (transparent PNG) from /public/assets: product-1..6.png */
export function ProductImg({ n, alt = '', eager = false }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/product-${n}.png?v=5`}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export const range = (n) => Array.from({ length: n }, (_, i) => i);
