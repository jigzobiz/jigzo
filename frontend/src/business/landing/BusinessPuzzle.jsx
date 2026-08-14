import React, { useMemo } from 'react';
import { buildEdgeMap, piecePath } from '../../puzzle/puzzle-shape';

const COLS = 3;
const ROWS = 3;
const CELL = 92;
const GAP = 2;

export default function BusinessPuzzle({ className = '', finalPiece = 4, label }) {
  const pieces = useMemo(() => {
    const edges = buildEdgeMap(COLS, ROWS, 407);
    return Array.from({ length: COLS * ROWS }, (_, index) => {
      const row = Math.floor(index / COLS);
      const column = index % COLS;
      return {
        index,
        path: piecePath(row, column, COLS, ROWS, CELL, CELL, edges),
        x: column * (CELL + GAP),
        y: row * (CELL + GAP)
      };
    });
  }, []);

  return (
    <svg className={`jzb-puzzle ${className}`} viewBox="-24 -24 330 330" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id="jzbPuzzleInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17140f" />
          <stop offset="1" stopColor="#4b3d2a" />
        </linearGradient>
      </defs>
      {pieces.map((piece) => (
        <g key={piece.index} transform={`translate(${piece.x} ${piece.y})`}>
          <path
            className={piece.index === finalPiece ? 'jzb-puzzle__piece jzb-puzzle__piece--final' : 'jzb-puzzle__piece'}
            d={piece.path}
          />
        </g>
      ))}
    </svg>
  );
}
