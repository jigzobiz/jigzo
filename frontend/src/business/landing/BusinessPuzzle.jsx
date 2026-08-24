import React, { useId, useMemo } from 'react';
import { buildEdgeMap, piecePath } from '../../puzzle/puzzle-shape';
import { CONSUMER_PUZZLE_GEOMETRY } from '../../puzzle/puzzle-geometry';

// Business's difficulty-picker/hero preview of the SOLVING experience — built from the
// SAME authoritative CONSUMER_PUZZLE_GEOMETRY (frontend/src/puzzle/puzzle-geometry.js)
// that the real recipient PuzzlePlayer (frontend/src/pages/ReceivePage.jsx, invoked with
// geometry=CONSUMER_PUZZLE_GEOMETRY by frontend/src/pages/InvitationRecipientPage.jsx)
// uses to actually solve the puzzle, per the locked product requirement that Business
// solving looks and plays exactly like consumer Receive. This is NOT the Business final
// revealed-invitation card's shape (that's 4:5 — see invitationCardGeometry.js and
// SolvedInvitationFrame) — this component only ever previews the puzzle itself. Board/
// grid can no longer drift apart between "what Studio shows here" and "what the recipient
// actually solves" — both read from one definition.
const { board: BOARD, grid: GRID } = CONSUMER_PUZZLE_GEOMETRY;

export default function BusinessPuzzle({ className = '', finalPiece = 4, label, imageUrl = null, mysteryMode = false, pieceCount = 18 }) {
  const clipId = `jzb-puzzle-image-${useId().replace(/:/g, '')}`;
  const showImage = Boolean(imageUrl && !mysteryMode);
  const pieces = useMemo(() => {
    const layout = GRID[pieceCount] || GRID[18];
    const pieceW = BOARD.width / layout.cols;
    const pieceH = BOARD.height / layout.rows;
    const edges = buildEdgeMap(layout.cols, layout.rows, 407 + pieceCount);
    return Array.from({ length: layout.cols * layout.rows }, (_, index) => {
      const row = Math.floor(index / layout.cols);
      const column = index % layout.cols;
      return {
        index,
        path: piecePath(row, column, layout.cols, layout.rows, pieceW, pieceH, edges),
        x: column * pieceW,
        y: row * pieceH
      };
    });
  }, [pieceCount]);

  // Boundary edges are always flat (see piecePath: dir=0 on every outer edge of the
  // grid) — only shared internal edges between neighboring pieces carry tabs, and those
  // tabs land entirely within a neighbor's own cell. So the assembled outline never
  // extends past the board rectangle and needs no outer clearance margin — a viewBox
  // exactly matching the board fills its container edge-to-edge with zero letterboxing,
  // at the board's exact aspect ratio (9:16, same as consumer Receive).
  const viewBox = `0 0 ${BOARD.width} ${BOARD.height}`;

  return (
    <svg className={`jzb-puzzle${showImage ? ' jzb-puzzle--image' : ''} ${className}`} viewBox={viewBox} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id="jzbPuzzleInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17140f" />
          <stop offset="1" stopColor="#4b3d2a" />
        </linearGradient>
        {showImage && <clipPath id={clipId}>{pieces.map((piece) => <path key={piece.index} transform={`translate(${piece.x} ${piece.y})`} d={piece.path} />)}</clipPath>}
      </defs>
      {showImage && <image href={imageUrl} x="0" y="0" width={BOARD.width} height={BOARD.height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />}
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
