import React, { useId, useMemo } from 'react';
import { piecePath } from '../../puzzle/puzzle-shape';
import { CONSUMER_PUZZLE_GEOMETRY } from '../../puzzle/puzzle-geometry';
import { computeLayout, computeHomes, computeEdgeMap, computeScatter } from '../../puzzle/puzzle-layout';

// Business's puzzle-solving preview (Studio's PuzzleArea hero + the 6/15/18/28 difficulty
// cards) — a STATIC, non-interactive rendering of the SAME loose/scattered starting state
// a recipient actually sees when their board first loads on /i, not an assembled poster.
// The locked product requirement is that what the sender previews here must faithfully
// represent what the guest actually solves, so this reads its layout (padding, piece
// sizing, tab clearance, snap threshold, starting scatter) and its piece shapes from the
// SAME shared sources the real interactive PuzzlePlayer (frontend/src/pages/ReceivePage.jsx)
// consumes — puzzle-layout.js and puzzle-shape.js — never a second, independently-tuned
// approximation. There is exactly one puzzle-layout implementation; this component only
// draws it statically.
const REST_SHADOW = 'drop-shadow(0 2px 3px rgba(5,5,5,0.22)) drop-shadow(0 1px 1px rgba(5,5,5,0.15))';

export default function BusinessPuzzle({ className = '', label, imageUrl = null, mysteryMode = false, pieceCount = 18 }) {
  const clipBase = `jzb-piece-${useId().replace(/:/g, '')}`;
  const showImage = Boolean(imageUrl && !mysteryMode);
  const layout = useMemo(() => computeLayout(CONSUMER_PUZZLE_GEOMETRY, pieceCount), [pieceCount]);
  const { cols, rows, BW, BH, PAD, stageW, stageH, pieceW, pieceH } = layout;

  const pieces = useMemo(() => {
    const homes = computeHomes(layout);
    const edgeMap = computeEdgeMap(layout);
    const positions = computeScatter(layout, homes);
    return homes.map((h, index) => ({
      index,
      r: h.r,
      c: h.c,
      ...positions[index],
      d: piecePath(h.r, h.c, layout.cols, layout.rows, layout.pieceW, layout.pieceH, edgeMap)
    }));
  }, [layout]);

  return (
    <svg className={`jzb-puzzle${showImage ? ' jzb-puzzle--image' : ''} ${className}`} viewBox={`0 0 ${stageW} ${stageH}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id="jzbPuzzleInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17140f" />
          <stop offset="1" stopColor="#4b3d2a" />
        </linearGradient>
      </defs>
      <rect className="jzb-puzzle__frame" x={PAD} y={PAD} width={BW} height={BH} rx="14" />
      {pieces.map((piece) => {
        const clipId = `${clipBase}-${piece.index}`;
        return (
          <g key={piece.index} style={{ filter: REST_SHADOW }} transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rot} ${pieceW / 2} ${pieceH / 2})`}>
            {showImage && <defs><clipPath id={clipId}><path d={piece.d} /></clipPath></defs>}
            {showImage && <g clipPath={`url(#${clipId})`}><image href={imageUrl} x={-piece.c * pieceW} y={-piece.r * pieceH} width={BW} height={BH} preserveAspectRatio="xMidYMid slice" /></g>}
            <path className="jzb-puzzle__piece" d={piece.d} />
          </g>
        );
      })}
    </svg>
  );
}
