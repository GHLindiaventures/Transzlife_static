import { useRef } from 'react';
import useCompare from '../hooks/useCompare.js';

const BASE = import.meta.env.BASE_URL;
const NAMES = ['before', 'after']; // stable reference for the hook

/**
 * Draggable before / after stage that fills its parent (position: relative/absolute parent).
 * `data` = { kind: 'cutout' | 'scene', before: {src, alt, label, sub}, after: {...} }
 *  - 'scene'  : two full pictures, aligned, shown edge to edge
 *  - 'cutout' : two transparent artworks, centred on a murky (before) / fresh botanical (after) backdrop
 */
export default function CompareStage({ data }) {
  const stageRef = useRef(null);
  const handleRef = useRef(null);
  useCompare(stageRef, handleRef, NAMES);

  const { kind, before, after } = data;
  const size = kind === 'scene' ? { width: 1400, height: 667 } : { width: 800, height: 547 };
  const pic = (side, cls) => (
    <img className="cmp-img" src={`${BASE}assets/${side.src}`} alt={side.alt} {...size} loading="lazy" decoding="async" draggable="false" />
  );

  return (
    <div className={`cmp cmp--${kind}`} ref={stageRef} style={{ '--pos': 50 }} aria-roledescription="comparison">
      <div className="psc-layer cmp-before">
        <div className="cmp-bg" aria-hidden="true"><span className="cmp-haze" /></div>
        {pic(before)}
      </div>
      <div className="psc-layer psc-illus cmp-after">
        <div className="cmp-bg" aria-hidden="true"><span className="cmp-glow" /></div>
        {pic(after)}
      </div>

      <p className="psc-concept" aria-hidden="true">Conceptual illustration</p>

      <div
        className="psc-handle"
        ref={handleRef}
        role="slider"
        tabIndex={0}
        aria-label="Drag or use the arrow keys to compare"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="50"
        aria-valuetext="Comparison slider"
      >
        <span className="psc-line" aria-hidden="true" />
        <span className="psc-knob" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M9 6 3 12l6 6M15 6l6 6-6 6" /></svg>
        </span>
      </div>
    </div>
  );
}
