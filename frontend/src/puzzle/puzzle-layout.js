import { buildEdgeMap, mulberry32 } from './puzzle-shape';

// Single shared source for puzzle BOARD/STAGE layout math — board padding, piece sizing,
// tab clearance, snap threshold, and the deterministic starting scatter — consumed by
// BOTH the real interactive PuzzlePlayer (frontend/src/pages/ReceivePage.jsx) and
// Business Studio's static, non-interactive puzzle preview
// (frontend/src/business/landing/BusinessPuzzle.jsx), so "what Studio shows" and "what a
// recipient actually solves" can never drift apart, and there is exactly one place these
// numbers live rather than two files independently agreeing on them.
//
// This module is deliberately narrow: only deterministic presentation math (given a
// geometry + piece count, where do pieces sit and what shape are they). It has no React
// state, no drag/pointer handling, no solve semantics, no snap/lock behavior — all of
// that stays entirely inside PuzzlePlayer and must never be duplicated here.
export const EDGE_MAP_SEED = 1337;
export const STAGE_PAD = 46;

export function computeLayout(geometry, pieceCount) {
  const g = geometry.grid[pieceCount] || { cols: 3, rows: 6 };
  const cols = g.cols, rows = g.rows;
  const BW = geometry.board.width, BH = geometry.board.height, PAD = STAGE_PAD;
  const stageW = BW + PAD * 2, stageH = BH + PAD * 2;
  const pieceW = BW / cols, pieceH = BH / rows;
  const tabPad = 0.46 * Math.max(pieceW, pieceH);
  const bound = Math.min(tabPad, PAD);
  const elemW = pieceW + tabPad * 2, elemH = pieceH + tabPad * 2;
  const SNAP = Math.max(20, Math.min(pieceW, pieceH) * 0.36);
  return { cols, rows, BW, BH, PAD, stageW, stageH, pieceW, pieceH, tabPad, bound, elemW, elemH, SNAP };
}

export function computeHomes(layout) {
  const { cols, rows, PAD, pieceW, pieceH } = layout;
  const homes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      homes.push({ r, c, hx: PAD + c * pieceW, hy: PAD + r * pieceH });
    }
  }
  return homes;
}

export function computeEdgeMap(layout) {
  return buildEdgeMap(layout.cols, layout.rows, EDGE_MAP_SEED);
}

// The exact deterministic starting-scatter formula: seeded per grid size so every
// solving/preview surface that asks for the same (cols,rows) gets the same pile.
export function computeScatter(layout, homes) {
  const { cols, rows, bound, stageW, stageH, pieceW, pieceH, SNAP } = layout;
  const rand = mulberry32(4242 + (cols * 31 + rows) * 77);
  const minX = bound, maxX = stageW - pieceW - bound;
  const minY = bound, maxY = stageH - pieceH - bound;
  return homes.map((h) => {
    let x, y, tries = 0;
    do {
      x = minX + rand() * (maxX - minX);
      y = minY + rand() * (maxY - minY);
      tries++;
    } while (tries < 8 && Math.hypot(x - h.hx, y - h.hy) < SNAP * 2);
    return { x, y, rot: (rand() - 0.5) * 2 * 9 };
  });
}
