import React, { useMemo, useState } from 'react';
import { buildEdgeMap, piecePath } from '../../puzzle/puzzle-shape';

// The near-black arrival stage (locked Claude Design recipient spec, revision 2, frame
// B1): envelope forward from depth, real JIGZO piece silhouettes (buildEdgeMap/piecePath,
// the same shared geometry module every other puzzle surface uses) rather than invented
// decoration, teaser copy the only text on screen. "Tap anywhere skips ahead" — the whole
// scene is the control, not just the envelope. On tap the pieces spill outward and the
// flap opens (skipped under prefers-reduced-motion) before the parent swaps to the real,
// already-scattered PuzzlePlayer board — a short, premium handover rather than a
// pixel-matched continuity between two separate rendering systems.
const SCATTER = [
  { x: 96, y: 158, rot: -14 },
  { x: 150, y: 172, rot: 9 },
  { x: 118, y: 140, rot: 24 },
  { x: 176, y: 150, rot: -6 },
  { x: 200, y: 168, rot: 16 }
];
const OPEN_DELAY_MS = 550;

export default function ArrivalScene({ copy, isArabic, onContinue }) {
  const [opening, setOpening] = useState(false);
  const pieces = useMemo(() => {
    const edges = buildEdgeMap(3, 2, 88);
    const cells = [[0, 0], [0, 1], [1, 0], [1, 2], [0, 2]];
    return cells.map(([row, col], index) => ({
      index,
      d: piecePath(row, col, 3, 2, 30, 22, edges),
      ...SCATTER[index]
    }));
  }, []);

  const handleContinue = () => {
    if (opening) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { onContinue(); return; }
    setOpening(true);
    window.setTimeout(onContinue, OPEN_DELAY_MS);
  };

  return <button
    type="button"
    className={`jzj-arrival jzj-arrival--interactive jzj-arrival__cta${opening ? ' jzj-arrival--opening' : ''}`}
    dir={isArabic ? 'rtl' : 'ltr'}
    onClick={handleContinue}
  >
    <div className="jzj-arrival__copy">
      <p className="jzj-arrival__title">{copy.arrivalTitle}</p>
      <p className="jzj-arrival__subtitle">{copy.arrivalSubtitle}</p>
    </div>
    <div className="jzj-arrival__stage">
      <span className="jzj-arrival__ghost jzj-arrival__ghost--far" aria-hidden="true" />
      <span className="jzj-arrival__ghost jzj-arrival__ghost--near" aria-hidden="true" />
      <svg className="jzj-arrival__pieces" viewBox="0 0 300 210" aria-hidden="true">
        {pieces.map((piece) => (
          <g key={piece.index} className="jzj-arrival__piece" style={{ '--jzj-x': `${piece.x}px`, '--jzj-y': `${piece.y}px`, '--jzj-rot': `${piece.rot}deg`, '--jzj-delay': `${0.32 + piece.index * 0.07}s` }} transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rot})`}>
            <path d={piece.d} transform="translate(-15 -11)" />
          </g>
        ))}
      </svg>
      <span className="jzj-arrival__envelope" aria-hidden="true">
        <span className="jzj-arrival__envelope-flap" />
      </span>
    </div>
  </button>;
}
