// Single authoritative source for puzzle SOLVING board geometry (board size + the grid
// each piece count divides it into). Consumed by the one shared PuzzlePlayer solving
// engine (frontend/src/pages/ReceivePage.jsx) for BOTH the consumer and Business
// recipient flows — there is only ever one geometry, because the locked product
// requirement is that Business solving must look and play exactly like consumer Receive.
//
// This file is intentionally NOT the source of the Business final-invitation card's
// shape (4:5, the locked Claude Design recipient spec) — that is a completely separate
// concern, presentation of the already-solved image, not the puzzle mechanics. See
// frontend/src/business/invitationCardGeometry.js. Do not add a second board/grid object
// here for Business "puzzle" purposes again — that was tried once and was wrong: it
// changed cell proportions (and therefore piece shapes) away from what Receive actually
// plays, even though it reused the same cols/rows numbers. If Business solving ever needs
// to look identical to Receive, it must import CONSUMER_PUZZLE_GEOMETRY directly, not a
// same-shaped duplicate.
//
// This is PuzzlePlayer's default when no `geometry` prop is passed, and must stay exactly
// what it has always been — every existing consumer puzzle (and every Business campaign,
// which explicitly passes this same object) was built against it.
export const CONSUMER_PUZZLE_GEOMETRY = {
  board: { width: 288, height: 512 },
  grid: {
    6: { cols: 2, rows: 3 },
    15: { cols: 3, rows: 5 },
    18: { cols: 3, rows: 6 },
    28: { cols: 4, rows: 7 }
  }
};
