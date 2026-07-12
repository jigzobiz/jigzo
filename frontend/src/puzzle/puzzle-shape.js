/* deterministic seeded RNG so neighbouring pieces agree on tab direction */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* tab-out (+1) / blank-in (-1) map for every internal edge of a cols x rows grid. */
export function buildEdgeMap(cols, rows, seed) {
  const rand = mulberry32(seed);
  const horizontal = []; // (rows-1) x cols
  const vertical = [];   // rows x (cols-1)
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

/* One box edge (x0,y0)->(x1,y1). dir: 0 flat, +1 knob out, -1 blank in. */
export function edgeWithTab(x0, y0, x1, y1, dir) {
  if (dir === 0) return ` L ${x1} ${y1}`;

  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;   // unit vector along the edge
  const nx = uy, ny = -ux;                         // unit normal to the edge
  const s = dir;                                   // knob direction (out/in)

  const P = (a, o) => (x0 + ux * L * a + nx * (o * L * s)).toFixed(3) + " " +
                      (y0 + uy * L * a + ny * (o * L * s)).toFixed(3);

  return ` L ${P(0.35, 0)}` +
    ` C ${P(0.27, 0.05)} ${P(0.23, 0.24)} ${P(0.34, 0.30)}` +
    ` C ${P(0.41, 0.42)} ${P(0.59, 0.42)} ${P(0.66, 0.30)}` +
    ` C ${P(0.77, 0.24)} ${P(0.73, 0.05)} ${P(0.65, 0)}` +
    ` L ${x1} ${y1}`;
}

/* full outline for piece (r,c) in a cols x rows grid. */
export function piecePath(r, c, cols, rows, pw, ph, edgeMap) {
  const top = r === 0 ? 0 : edgeMap.horizontal[r - 1][c];
  const bottom = r === rows - 1 ? 0 : -edgeMap.horizontal[r][c];
  const left = c === 0 ? 0 : edgeMap.vertical[r][c - 1];
  const right = c === cols - 1 ? 0 : -edgeMap.vertical[r][c];

  const x0 = 0, y0 = 0, x1 = pw, y1 = ph;

  let d = `M ${x0} ${y0}`;
  d += edgeWithTab(x0, y0, x1, y0, top);     // top edge
  d += edgeWithTab(x1, y0, x1, y1, right);   // right edge
  d += edgeWithTab(x1, y1, x0, y1, bottom);  // bottom edge
  d += edgeWithTab(x0, y1, x0, y0, left);    // left edge
  d += " Z";
  return d;
}
