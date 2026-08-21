import React, { useMemo } from 'react';
import { buildEdgeMap, piecePath } from '../../puzzle/puzzle-shape';

// A lightweight, CSS-only "envelope arrives, puzzle pieces spill out and settle" prelude.
// Reuses the real piece silhouettes (buildEdgeMap/piecePath, the same shared geometry
// module every other puzzle surface uses) rather than inventing decorative shapes, so it
// reads as unmistakably JIGZO rather than generic confetti/illustration.
//
// mode="interactive" (the real /i recipient page) plays the settle-in animation once,
// and — per prefers-reduced-motion — the *default* CSS state is already the settled
// composition; the animation is only layered on for users who don't mind motion.
// mode="static" (the Business Studio storyboard preview) always renders the settled
// composition with no animation at all, regardless of motion preference.
const SCATTER = [
  { x: 96, y: 158, rot: -14 },
  { x: 150, y: 172, rot: 9 },
  { x: 118, y: 140, rot: 24 },
  { x: 176, y: 150, rot: -6 },
  { x: 200, y: 168, rot: 16 }
];

export default function ArrivalScene({ mode = 'interactive', compact = false, copy, isArabic, onContinue }) {
  const pieces = useMemo(() => {
    const edges = buildEdgeMap(3, 2, 88);
    const cells = [[0, 0], [0, 1], [1, 0], [1, 2], [0, 2]];
    return cells.map(([row, col], index) => ({
      index,
      d: piecePath(row, col, 3, 2, 30, 22, edges),
      ...SCATTER[index]
    }));
  }, []);

  return <div className={`jzj-arrival${mode === 'interactive' ? ' jzj-arrival--interactive' : ' jzj-arrival--static'}${compact ? ' jzj-arrival--compact' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
    <svg className="jzj-arrival__scene" viewBox="0 0 320 220" role="img" aria-hidden="true">
      {pieces.map((piece) => (
        <g key={piece.index} className="jzj-arrival__piece" style={{ '--jzj-x': `${piece.x}px`, '--jzj-y': `${piece.y}px`, '--jzj-rot': `${piece.rot}deg`, '--jzj-delay': `${0.32 + piece.index * 0.07}s` }} transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rot})`}>
          <path d={piece.d} transform="translate(-15 -11)" />
        </g>
      ))}
      <g className="jzj-arrival__envelope" transform="translate(100 48)">
        <path className="jzj-arrival__envelope-body" d="M0 10 L60 10 L120 10 L120 74 L0 74 Z" />
        <path className="jzj-arrival__envelope-flap" d="M0 10 L60 54 L120 10" />
      </g>
    </svg>
    <p className="jzj-arrival__teaser">{copy.arrivalTeaser}</p>
    {mode === 'interactive' && <button type="button" className="jzj-arrival__cta" onClick={onContinue}>{copy.solveAction}</button>}
  </div>;
}
