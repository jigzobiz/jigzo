// The Business FINAL revealed-invitation card's shape (locked Claude Design recipient
// spec, revision 2 — "Why 4:5, not 3:2": needs vertical room for a title, two metadata
// lines and a message without covering the photo). This is presentation of the ALREADY
// SOLVED image — SolvedInvitationFrame (both the real post-solve reveal and the Studio
// preview) and the crop tool that frames it — and has nothing to do with how the puzzle
// is solved. Puzzle-solving geometry is CONSUMER_PUZZLE_GEOMETRY in
// frontend/src/puzzle/puzzle-geometry.js, used unchanged by Business.
//
// SolvedInvitationFrame's own CSS (business-journey.css, `.jzj-solved__frame{aspect-ratio:
// 4/5}`) expresses the same ratio directly since CSS can't import this constant — both
// are exactly 4:5, a simple ratio unlikely to drift by accident; if this ever changes,
// update that CSS rule (and BusinessImageCropModal's crop frame) alongside it.
export const BUSINESS_INVITATION_CARD = { width: 288, height: 360 };
