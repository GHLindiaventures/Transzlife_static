/* Shared botanical drawings: leaf, sprig and laurel wreath (SVG, tinted by CSS). */

export const LEAF = (
  <>
    <path d="M6 54C10 26 30 8 58 4c-2 30-22 50-52 50z" />
    <path d="M6 54 40 20" />
  </>
);

/** Decorative sprig: a curved stem with leaves. Pure SVG, tinted by CSS. */
export function Sprig({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 220" aria-hidden="true">
      <path className="psc-stem" d="M60 214C52 160 70 110 58 6" />
      {[
        [58, 170, -38, 1], [62, 138, 40, 1.1], [56, 104, -42, 1], [62, 72, 38, .95], [58, 40, -34, .85], [60, 14, 18, .6],
      ].map(([x, y, r, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s * .5}) translate(-6 -54)`}>{LEAF}</g>
      ))}
    </svg>
  );
}

/** Laurel wreath of classical leaves + gold berries, drawn around the illustration. */
export function Wreath({ className }) {
  const leaves = [];
  const N = 30;
  for (let ring = 0; ring < 2; ring += 1) {
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2 + (ring ? Math.PI / N : 0);
      const r = ring ? 150 : 176;
      const x = 200 + Math.cos(a) * r, y = 200 + Math.sin(a) * r;
      const rot = (a * 180) / Math.PI + 44 + (i % 2 ? -22 : 22);
      leaves.push(
        <g key={`${ring}-${i}`} className={ring ? 'psc-w2' : 'psc-w1'} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${ring ? 0.34 : 0.46}) translate(-6 -54)`}>{LEAF}</g>
      );
    }
  }
  const berries = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    return <circle key={i} className="psc-berry" cx={(200 + Math.cos(a) * 128).toFixed(1)} cy={(200 + Math.sin(a) * 128).toFixed(1)} r={i % 2 ? 4.5 : 3} />;
  });
  return (
    <svg className={className} viewBox="0 0 400 400" aria-hidden="true">
      <circle className="psc-ring" cx="200" cy="200" r="163" />
      {leaves}
      {berries}
    </svg>
  );
}
