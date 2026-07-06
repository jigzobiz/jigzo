/* =============================================================
   puzzle-shape.js — single source of truth for Jigzo piece geometry.

   Loaded by BOTH the sender preview (create.html) and the live
   receiver board (receive.html) so the two can never drift apart.

   Classic tab-and-blank: a round mushroom knob (a circular bulb on a
   thin neck) on every internal edge, flat on the board border. The
   tab layout is symmetric about each shared edge, so neighbouring
   pieces interlock exactly — one piece's tab is precisely the
   neighbour's blank.

   These are declared as plain globals (function declarations) so both
   pages' in-browser-compiled components can call them directly.
   ============================================================= */

/* deterministic seeded RNG so neighbouring pieces agree on tab direction */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* tab-out (+1) / blank-in (-1) map for every internal edge of a cols x rows
   grid. Grids are non-square (portrait board), so columns and rows differ. */
function buildEdgeMap(cols, rows, seed) {
  const rand = mulberry32(seed);
  const horizontal = []; // (rows-1) x cols : edge between rows r/r+1 at col c
  const vertical = [];   // rows x (cols-1) : edge between cols c/c+1 at row r
  for (let r = 0; r < rows - 1; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(rand() > 0.5 ? 1 : -1);
    horizontal.push(row);
  }
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols - 1; c++) row.push(rand() > 0.5 ? 1 : -1);
    vertical.push(row);
  }
  return { horizontal, vertical };
}

/* One box edge (x0,y0)->(x1,y1). dir: 0 flat, +1 knob out, -1 blank in.
   Classic round mushroom knob: a thin neck (undercut) opening to a bulb
   wider than the neck. Built from cubic Beziers whose control points are
   ALL mirrored about the edge midpoint (a <-> 1-a). Because of that mirror
   symmetry, the same edge traced from either side with opposite dir yields
   a byte-for-byte identical curve — so a tab is exactly its neighbour's
   blank and pieces interlock with zero gap. (An arc-based knob can't do
   this: its neck curves aren't symmetric under reversal, leaving a ~0.1px
   seam.) */
function edgeWithTab(x0, y0, x1, y1, dir) {
  if (dir === 0) return ` L ${x1} ${y1}`;

  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;   // unit vector along the edge
  const nx = uy, ny = -ux;                         // unit normal to the edge
  const s = dir;                                   // knob direction (out/in)

  // point at fraction a along the edge, offset o (fraction of L) along the
  // outward normal. P(a,o) for one side == P(1-a,o) traced from the other,
  // which is the whole reason the interlock is exact.
  const P = (a, o) => (x0 + ux * L * a + nx * (o * L * s)).toFixed(3) + " " +
                      (y0 + uy * L * a + ny * (o * L * s)).toFixed(3);

  // Chunky, rounded knob: wide neck, a big round bulb well clear of the neck.
  // Control offsets peak at 0.42 (bulb top ~0.38 out); keep tabPad >= ~0.44*edge.
  return ` L ${P(0.35, 0)}` +
    ` C ${P(0.27, 0.05)} ${P(0.23, 0.24)} ${P(0.34, 0.30)}` +   // left neck: undercut out to the bulb
    ` C ${P(0.41, 0.42)} ${P(0.59, 0.42)} ${P(0.66, 0.30)}` +   // over the big round top
    ` C ${P(0.77, 0.24)} ${P(0.73, 0.05)} ${P(0.65, 0)}` +      // right neck: back down, symmetric
    ` L ${x1} ${y1}`;
}

/* full outline for piece (r,c) in a cols x rows grid: mushroom-knob tabs on
   internal edges, flat on the board border. Traversed top->right->bottom->left. */
function piecePath(r, c, cols, rows, pw, ph, edgeMap) {
  const top = r === 0 ? 0 : edgeMap.horizontal[r - 1][c];
  const bottom = r === rows - 1 ? 0 : -edgeMap.horizontal[r][c];
  const left = c === 0 ? 0 : edgeMap.vertical[r][c - 1];
  const right = c === cols - 1 ? 0 : -edgeMap.vertical[r][c];

  const x0 = 0, y0 = 0, x1 = pw, y1 = ph;

  let d = `M ${x0} ${y0}`;
  d += edgeWithTab(x0, y0, x1, y0, top);     // top edge, left -> right
  d += edgeWithTab(x1, y0, x1, y1, right);   // right edge, top -> bottom
  d += edgeWithTab(x1, y1, x0, y1, bottom);  // bottom edge, right -> left
  d += edgeWithTab(x0, y1, x0, y0, left);    // left edge, bottom -> top
  d += " Z";
  return d;
}
