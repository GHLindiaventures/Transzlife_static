import { useState } from 'react';
import { Media, Slot, Ph, range } from '../ui.jsx';

const POSITIONS = ['is-prev2', 'is-prev', 'is-active', 'is-next', 'is-next2'];
const TOTAL = 10;

export default function Reels() {
  const [idx, setIdx] = useState(0);
  const go = (i) => setIdx((i + TOTAL) % TOTAL);

  return (
    <section className="reels">
      <div className="reels__inner">
        <Slot as="h2" className="headline slot--headline" data-reveal />
        <div className="reels__stage" id="reels">
          {POSITIONS.map((pos, n) => (
            <div
              key={pos}
              className={`reel ${pos}`}
              onClick={() => { if (n < 2) go(idx - 1); else if (n > 2) go(idx + 1); }}
            >
              <Media className="media--reel" />
              {pos === 'is-active' && (
                <>
                  <button className="reel__ctrl reel__ctrl--play" type="button" aria-label="Play">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
                  </button>
                  <button className="reel__ctrl reel__ctrl--sound" type="button" aria-label="Sound">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 6h3l4-3v10L5 10H2z" /><path d="M12 5.5a4 4 0 010 5" /></svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <Ph className="reels__chip">
          <Media className="media--chip" />
          <div className="reels__chip-text">
            <Slot className="slot--card-title" />
            <span className="reels__chip-price">
              <Slot className="slot--price" /><Slot className="slot--price" /><Slot className="slot--pill" />
            </span>
          </div>
        </Ph>
        <div className="reels__dots">
          {range(TOTAL).map((n) => (
            <button key={n} className={`dot${n === idx ? ' is-active' : ''}`} type="button" aria-label={String(n + 1)} onClick={() => go(n)} />
          ))}
        </div>
      </div>
    </section>
  );
}
