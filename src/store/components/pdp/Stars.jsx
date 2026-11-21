import { Star } from 'lucide-react';

/** Read-only star row; supports fractions (4.3 fills 4 stars and 30% of the fifth). */
export default function Stars({ value = 0, size = 16, label }) {
  return (
    <span className="stars" role="img" aria-label={label || `${value.toFixed(1)} out of 5 stars`} style={{ '--size': `${size}px` }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span className="stars__one" key={i} aria-hidden="true">
            <Star size={size} className="stars__bg" />
            <span className="stars__fill" style={{ width: `${fill * 100}%` }}><Star size={size} /></span>
          </span>
        );
      })}
    </span>
  );
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Star picker for the review form: a radio group, so arrow keys work. */
export function StarInput({ value, onChange, name = 'rating' }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Your rating">
      <div className="star-input__row">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`star-input__star ${n <= value ? 'is-on' : ''}`}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}, ${LABELS[n]}`} />
            <Star size={30} aria-hidden="true" />
          </label>
        ))}
      </div>
      <span className="star-input__label" aria-live="polite">{value ? LABELS[value] : 'Tap to rate'}</span>
    </div>
  );
}
