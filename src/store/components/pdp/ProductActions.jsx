import { useEffect, useState } from 'react';
import { Heart, Share2, Check } from 'lucide-react';
import Stars from './Stars';
import { getFavourites } from '../../data/reviewStore';
import { toggleWishlist } from '../../lib/wishlist';
import { shareUrl, track } from '../../lib/track';
import { useAuth } from '../../context/AuthContext';

/** Rating line under the product name: stars, average, count. Jumps to the reviews section. */
export function RatingLine({ summary }) {
  const go = (e) => {
    e.preventDefault();
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <a href="#reviews" className="rating-line" onClick={go}>
      {summary.total ? (
        <>
          <Stars value={summary.avg} size={16} />
          <strong>{summary.avg.toFixed(1)}</strong>
          <span>{summary.total} review{summary.total === 1 ? '' : 's'}</span>
        </>
      ) : (
        <>
          <Stars value={0} size={16} label="No ratings yet" />
          <span>Be the first to review</span>
        </>
      )}
    </a>
  );
}

/** Favourite (heart) + share buttons, floating on the product image. */
export function GalleryActions({ product }) {
  const [fav, setFav] = useState(false);
  const [pop, setPop] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => setFav(getFavourites().includes(product.id)), [product.id]);
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(''), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  const { customer } = useAuth();
  const onFav = async () => {
    const on = await toggleWishlist(product.id, !!customer);
    setFav(on);
    if (on) { setPop(true); setTimeout(() => setPop(false), 600); }
    setFlash(on ? 'Saved to your favourites' : 'Removed from favourites');
  };

  const onShare = async () => {
    // ?ref=share lets us count visits that arrive through shared links
    const url = shareUrl();
    const data = { title: product.name, text: `${product.name}: ${product.tagline}`, url };
    try {
      if (navigator.share) { await navigator.share(data); track('share', { pid: product.id, method: 'native' }); return; }
      await navigator.clipboard.writeText(url);
      track('share', { pid: product.id, method: 'copy_link' });
      setFlash('Link copied');
    } catch (err) {
      if (err?.name !== 'AbortError') setFlash('Could not share. Copy the link from the address bar.');
    }
  };

  return (
    <>
      <div className="gal-actions">
        <button type="button" className={`gal-btn ${fav ? 'is-fav' : ''} ${pop ? 'is-pop' : ''}`} onClick={onFav} aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}>
          <Heart size={20} />
        </button>
        <button type="button" className="gal-btn" onClick={onShare} aria-label="Share this product">
          <Share2 size={19} />
        </button>
      </div>
      <div className={`toast ${flash ? 'is-on' : ''}`} role="status" aria-live="polite">
        {flash && <><Check size={16} /> {flash}</>}
      </div>
    </>
  );
}
