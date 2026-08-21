// Single authoritative source for puzzle board geometry (board size + the grid each
// piece count divides it into). Consumed by the one shared PuzzlePlayer solving engine
// (frontend/src/pages/ReceivePage.jsx) for both the consumer and Business recipient
// flows, and by BusinessPuzzle.jsx / BusinessImageCropModal.jsx for the Business Studio
// preview — so the assembled/solved geometry and the Studio preview geometry can never
// drift apart again.
//
// CONSUMER_PUZZLE_GEOMETRY is PuzzlePlayer's default when no `geometry` prop is passed,
// and must stay exactly what it has always been — this is what every existing consumer
// puzzle (and every already-created Business campaign, since Business always explicitly
// requests BUSINESS_PUZZLE_GEOMETRY) was built against.
export const CONSUMER_PUZZLE_GEOMETRY = {
  board: { width: 288, height: 512 },
  grid: {
    6: { cols: 2, rows: 3 },
    15: { cols: 3, rows: 5 },
    18: { cols: 3, rows: 6 },
    28: { cols: 4, rows: 7 }
  }
};

// Business invitations present as a flat 4x6 landscape card (3:2) rather than a
// phone-portrait photo — see BusinessPuzzle.jsx and BusinessImageCropModal.jsx.
export const BUSINESS_PUZZLE_GEOMETRY = {
  board: { width: 288, height: 192 },
  grid: {
    6: { cols: 3, rows: 2 },
    15: { cols: 5, rows: 3 },
    18: { cols: 6, rows: 3 },
    28: { cols: 7, rows: 4 }
  }
};
