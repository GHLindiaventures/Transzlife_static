import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

/* Small building blocks shared by every page. */

/** Empty text placeholder. Fill it with your own copy: <Slot as="h2" className="slot--rich">Text</Slot> */
export function Slot({ as: Tag = 'span', className = '', children, ...rest }) {
  return (
    <Tag className={`slot ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

/** Empty image / video placeholder. Put an <img> or <video> inside it. */
export const Media = forwardRef(function Media({ className = '', children, ...rest }, ref) {
  return (
    <div ref={ref} className={`media ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

/** Placeholder links (href="#") must not jump to the top. Swap for <Link to> / real URLs. */
export const stop = (e) => e.preventDefault();

/**
 * Fills a <Media> box. media: { src, alt } for an image, or { video, poster, label } for a muted looping video.
 * Paths are relative to /public. Nothing given -> nothing rendered (the box stays a placeholder).
 */
export function MediaContent({ media, eager = false }) {
  if (!media) return null;
  const url = (p) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;
  if (media.video) {
    return (
      <video
        src={url(media.video)}
        poster={media.poster ? url(media.poster) : undefined}
        aria-label={media.label}
        autoPlay muted loop playsInline preload="metadata"
      />
    );
  }
  return <img src={url(media.src)} alt={media.alt ?? ''} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

/** A real route link when `to` is given, otherwise the placeholder link. */
export function CtaLink({ to, children, ...rest }) {
  if (to) return <Link to={to} {...rest}>{children}</Link>;
  return <Ph {...rest}>{children}</Ph>;
}

export function Ph({ children, ...rest }) {
  return (
    <a href="#" onClick={stop} {...rest}>
      {children}
    </a>
  );
}

export const PRODUCTS = ['CycleRelief', 'Energy Booster', 'Reviva', 'PulmoClear', 'Liver Detox', 'BreatheFree'];

/** Product photo from /public/assets (1..6). */
export function ProductImg({ n, eager = false }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/product-${n}.jpg`}
      alt={PRODUCTS[n - 1]}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export const range = (n) => Array.from({ length: n }, (_, i) => i);
