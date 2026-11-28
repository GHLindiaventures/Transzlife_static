import '../styles/dna-loader.css';

const DUR = 1.8;

/** TranzLife DNA double-helix loader (GPU-composited transform animation). */
export default function DnaLoader({ variant = 'page', size = 'md', label = 'TRANZLIFE', columns = 12 }) {
  const cols = Array.from({ length: columns }, (_, i) => {
    const d = (-i * DUR) / columns;
    return (
      <div className="tl-dna__col" key={i}>
        <i className="tl-dna__rung" style={{ animationDelay: `${d.toFixed(3)}s` }} />
        <b className="tl-dna__bead tl-dna__bead--a" style={{ animationDelay: `${d.toFixed(3)}s` }} />
        <b className="tl-dna__bead tl-dna__bead--b" style={{ animationDelay: `${(d - DUR / 2).toFixed(3)}s` }} />
      </div>
    );
  });

  return (
    <div className={`tl-dna-wrap tl-dna-wrap--${variant}`} role="status" aria-busy="true" aria-label={label || 'Loading'}>
      <div className={`tl-dna${size === 'sm' ? ' tl-dna--sm' : ''}`} aria-hidden="true">{cols}</div>
      {label && <span className="tl-dna__label">{label}</span>}
    </div>
  );
}
