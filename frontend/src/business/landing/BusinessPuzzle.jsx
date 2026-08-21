import React, { useId, useMemo } from 'react';
import { buildEdgeMap, piecePath } from '../../puzzle/puzzle-shape';

// Mirrors the real shared puzzle player's grid per piece count
// (frontend/src/pages/ReceivePage.jsx GRID_FOR) so this Business Studio preview shows
// the actual playable geometry instead of an invented layout.
export const BUSINESS_PUZZLE_LAYOUTS = {
  6: { columns: 2, rows: 3 },
  15: { columns: 3, rows: 5 },
  18: { columns: 3, rows: 6 },
  28: { columns: 4, rows: 7 }
};
// The puzzle image is always this fixed 9:16 board regardless of piece count — only the
// grid subdividing it changes. Matches ReceivePage.jsx's BW/BH and the consumer /create
// crop output (CreatePage.jsx captureCrop OUT_W/OUT_H), so a customer-approved crop
// already fills this board exactly with no further slicing.
const BOARD_W = 288;
const BOARD_H = 512;

export default function BusinessPuzzle({ className = '', finalPiece = 4, label, imageUrl = null, mysteryMode = false, pieceCount = 18 }) {
  const clipId = `jzb-puzzle-image-${useId().replace(/:/g, '')}`;
  const showImage = Boolean(imageUrl && !mysteryMode);
  const { pieces, tabPad } = useMemo(() => {
    const layout = BUSINESS_PUZZLE_LAYOUTS[pieceCount] || BUSINESS_PUZZLE_LAYOUTS[18];
    const pieceW = BOARD_W / layout.columns;
    const pieceH = BOARD_H / layout.rows;
    const pad = 0.46 * Math.max(pieceW, pieceH);
    const edges = buildEdgeMap(layout.columns, layout.rows, 407 + pieceCount);
    const list = Array.from({ length: layout.columns * layout.rows }, (_, index) => {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      return {
        index,
        path: piecePath(row, column, layout.columns, layout.rows, pieceW, pieceH, edges),
        x: column * pieceW,
        y: row * pieceH
      };
    });
    return { pieces: list, tabPad: pad };
  }, [pieceCount]);

  const viewBox = `${-tabPad} ${-tabPad} ${BOARD_W + tabPad * 2} ${BOARD_H + tabPad * 2}`;

  return (
    <svg className={`jzb-puzzle${showImage ? ' jzb-puzzle--image' : ''} ${className}`} viewBox={viewBox} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id="jzbPuzzleInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17140f" />
          <stop offset="1" stopColor="#4b3d2a" />
        </linearGradient>
        {showImage && <clipPath id={clipId}>{pieces.map((piece) => <path key={piece.index} transform={`translate(${piece.x} ${piece.y})`} d={piece.path} />)}</clipPath>}
      </defs>
      {showImage && <image href={imageUrl} x="0" y="0" width={BOARD_W} height={BOARD_H} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />}
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
