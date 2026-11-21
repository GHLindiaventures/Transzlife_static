import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Silent, looping background video.
 * - Loads nothing until it is near the viewport (preload="none").
 * - Plays only while visible, pauses when scrolled away (saves battery and data).
 * - Shows the poster image only for visitors who prefer reduced motion.
 */
export function AutoVideo({ src, poster, className = '', label }) {
  const ref = useRef(null);
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    const v = ref.current;
    if (!v || still || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { rootMargin: '120px 0px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [still]);

  if (still) return <img src={poster} alt={label || ''} className={className} />;
  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** "Watch the film" button that opens a shadcn Dialog with a video player. */
export function FilmDialog({ src, poster, title, description, label = 'Watch the film' }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="film-btn">
          <span className="film-btn__icon"><Play size={18} fill="currentColor" /></span>
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="film-dialog">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <video className="film-dialog__video" src={src} poster={poster} controls autoPlay playsInline />
        <div className="film-dialog__caption">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
