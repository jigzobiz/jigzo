import React, { useId, useMemo } from 'react';
import { buildEdgeMap, piecePath } from '../../puzzle/puzzle-shape';

export const BUSINESS_PUZZLE_LAYOUTS = {
  6: { columns: 3, rows: 2 },
  15: { columns: 5, rows: 3 },
  18: { columns: 6, rows: 3 },
  28: { columns: 7, rows: 4 }
};
const BOARD = 280;
const GAP = 2;

export default function BusinessPuzzle({ className = '', finalPiece = 4, label, imageUrl = null, mysteryMode = false, pieceCount = 18 }) {
  const clipId = `jzb-puzzle-image-${useId().replace(/:/g, '')}`;
  const showImage = Boolean(imageUrl && !mysteryMode);
  const pieces = useMemo(() => {
    const layout = BUSINESS_PUZZLE_LAYOUTS[pieceCount] || BUSINESS_PUZZLE_LAYOUTS[18];
    const cell = (BOARD - GAP * (layout.columns - 1)) / layout.columns;
    const height = layout.rows * cell + GAP * (layout.rows - 1);
    const offsetY = (BOARD - height) / 2;
    const edges = buildEdgeMap(layout.columns, layout.rows, 407 + pieceCount);
    return Array.from({ length: layout.columns * layout.rows }, (_, index) => {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      return {
        index,
        path: piecePath(row, column, layout.columns, layout.rows, cell, cell, edges),
        x: column * (cell + GAP),
        y: offsetY + row * (cell + GAP)
      };
    });
  }, [pieceCount]);

  return (
    <svg className={`jzb-puzzle${showImage ? ' jzb-puzzle--image' : ''} ${className}`} viewBox="-24 -24 330 330" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id="jzbPuzzleInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17140f" />
          <stop offset="1" stopColor="#4b3d2a" />
        </linearGradient>
        {showImage && <clipPath id={clipId}>{pieces.map((piece) => <path key={piece.index} transform={`translate(${piece.x} ${piece.y})`} d={piece.path} />)}</clipPath>}
      </defs>
      {showImage && <image href={imageUrl} x="0" y="0" width="280" height="280" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />}
      {pieces.map((piece) => (
        <g key={piece.index} transform={`translate(${piece.x} ${piece.y})`}>
          <path
            className={piece.index === finalPiece % pieces.length ? 'jzb-puzzle__piece jzb-puzzle__piece--final' : 'jzb-puzzle__piece'}
            d={piece.path}
          />
        </g>
      ))}
    </svg>
  );
}
