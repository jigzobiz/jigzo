import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/*
 * HeroPhonePuzzle — Claude Design "Phone Puzzle Reveal" (project
 * "JIGZO Conversion Experience Redesign", file "Phone Puzzle Reveal.dc.html").
 *
 * The scene components below (geometry, Phone, PuzzleScreenBase, SettledPiece,
 * FloatingPieceOverlay, Rotate/PuzzleHold/PuzzleDrop/Reveal) are ported VERBATIM
 * from the design's phone-reveal-scene.jsx — only the two asset URLs are pointed
 * at /assets/. The design's own runtime (support.js + animations-v2.jsx) renders
 * inside a dark, shadowed, playback-bar Stage that is unusable as a transparent
 * overlay, so the timeline engine is replaced with the minimal, transparent
 * scene runner at the bottom (same useScene()/Easing/clamp contract, same
 * scenes + play-once playback declared in the .dc.html).
 */

/* ── geometry (verbatim) ─────────────────────────────────────────────────── */
const COLS = 3, ROWS = 6;
const CANVAS_W = 1080, CANVAS_H = 1920;
const PHONE_W = 340, PHONE_H = 700, PHONE_D = 36;
const SIDE_BEZEL = 6;
const TOP_BEZEL = 6;
const SCREEN_W = PHONE_W - SIDE_BEZEL * 2, SCREEN_H = PHONE_H - TOP_BEZEL * 2;
const CELL_W = SCREEN_W / COLS, CELL_H = SCREEN_H / ROWS;
const TAB = 0.30 * ((CELL_W + CELL_H) / 2);
const NECK = -0.05 * ((CELL_W + CELL_H) / 2);
const FLOAT_DY = -650;
const FR = 3, FC = 1;
const SCREEN_LEFT = CANVAS_W / 2 - PHONE_W / 2 + SIDE_BEZEL;
const SCREEN_TOP = CANVAS_H / 2 - PHONE_H / 2 + TOP_BEZEL;

const edgesV = [[1, -1], [-1, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const edgesH = [[1, -1, 1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, -1]];

function corner(c, r) { return { x: c * CELL_W, y: r * CELL_H }; }

function tabPoints(p0, p1, dir) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const prof = [[0, 0], [0.30, 0], [0.35, NECK], [0.40, TAB * 0.85], [0.46, TAB], [0.54, TAB], [0.60, TAB * 0.85], [0.65, NECK], [0.70, 0], [1, 0]];
  return prof.map(([a, r2]) => ({ x: p0.x + dx * a + nx * r2 * dir, y: p0.y + dy * a + ny * r2 * dir }));
}

function catmull(points) {
  const n = points.length;
  const get = (i) => points[Math.max(0, Math.min(n - 1, i))];
  let d = '';
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function reversed(arr) { return arr.slice().reverse(); }

function edgeCmds(points) {
  if (points.length <= 2) { const p = points[points.length - 1]; return ` L ${p.x.toFixed(2)},${p.y.toFixed(2)}`; }
  return catmull(points);
}

const cutsV = [];
for (let r = 0; r < ROWS; r++) { cutsV.push([]); for (let c = 0; c < COLS - 1; c++) { cutsV[r].push(tabPoints(corner(c + 1, r), corner(c + 1, r + 1), edgesV[r][c])); } }
const cutsH = [];
for (let r = 0; r < ROWS - 1; r++) { cutsH.push([]); for (let c = 0; c < COLS; c++) { cutsH[r].push(tabPoints(corner(c, r + 1), corner(c + 1, r + 1), edgesH[r][c])); } }

function piecePath(r, c, dy) {
  let top = r === 0 ? [corner(c, 0), corner(c + 1, 0)] : cutsH[r - 1][c];
  let right = c === COLS - 1 ? [corner(COLS, r), corner(COLS, r + 1)] : cutsV[r][c];
  let bottom = r === ROWS - 1 ? [corner(c, ROWS), corner(c + 1, ROWS)] : reversed(cutsH[r][c]);
  let left = c === 0 ? [corner(0, r + 1), corner(0, r)] : reversed(cutsV[r][c - 1]);
  const shift = (p) => (dy ? { x: p.x, y: p.y + dy } : p);
  top = top.map(shift); right = right.map(shift); bottom = bottom.map(shift); left = left.map(shift);
  let d = `M ${top[0].x.toFixed(2)},${top[0].y.toFixed(2)}`;
  d += edgeCmds(top); d += edgeCmds(right); d += edgeCmds(bottom); d += edgeCmds(left);
  return d + ' Z';
}

const CAVITY_D = piecePath(FR, FC, 0);
const STATIC_PIECES = (() => {
  const list = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (r === FR && c === FC) continue; list.push({ r, c, d: piecePath(r, c, 0) }); }
  return list;
})();

const PHOTO = '/assets/demo-photo.png';
const REVEAL = '/assets/demo-reveal.png';
const imgStyle = { position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H, objectFit: 'cover' };

/* ── scene components (verbatim, asset URLs swapped to /assets/) ──────────── */
function PuzzleScreenBase() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#141416' }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${CAVITY_D}')`, background: '#0e0e10' }}>
        <img src={PHOTO} style={{ ...imgStyle, filter: 'brightness(0.32) saturate(0.5)' }} />
      </div>
      {STATIC_PIECES.map((p) => (
        <div key={`p-${p.r}-${p.c}`} style={{ position: 'absolute', inset: 0, clipPath: `path('${p.d}')` }}>
          <img src={PHOTO} style={imgStyle} />
        </div>
      ))}
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {STATIC_PIECES.map((p) => (<path key={`s-${p.r}-${p.c}`} d={p.d} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.4" />))}
      </svg>
    </div>
  );
}

function SettledPiece() {
  const d = piecePath(FR, FC, 0);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')` }}>
        <img src={PHOTO} style={imgStyle} />
      </div>
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

function FloatingPieceOverlay({ dy, opacity, flashOpacity }) {
  const d = piecePath(FR, FC, 0);
  const liftT = clamp(Math.abs(dy) / Math.abs(FLOAT_DY), 0, 1);
  return (
    <div style={{ position: 'absolute', left: SCREEN_LEFT, top: SCREEN_TOP, width: SCREEN_W, height: SCREEN_H, opacity, transform: `translateY(${dy}px)` }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, filter: `drop-shadow(0 ${10 + liftT * 26}px ${18 + liftT * 34}px rgba(0,0,0,${(0.3 + liftT * 0.25).toFixed(2)}))` }}>
        <img src={PHOTO} style={imgStyle} />
      </div>
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1.4" />
      </svg>
      {flashOpacity > 0.001 && (
        <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, background: 'linear-gradient(135deg, #FFE3A0 0%, #E8B04B 45%, #8C5A2B 100%)', opacity: flashOpacity }} />
      )}
    </div>
  );
}

function Phone({ rotateY, scaleVal, opacity = 1, screen }) {
  const W = PHONE_W, H = PHONE_H, D = PHONE_D;
  const bezelGrad = 'linear-gradient(160deg, #eaeaed 0%, #c7c7cc 22%, #f3f3f5 45%, #b9b9bf 62%, #e4e4e7 80%, #d0d0d4 100%)';
  const lensGrad = 'radial-gradient(circle at 35% 30%, #4a4a50, #0d0d0f 70%)';
  const frontVisible = Math.cos((rotateY * Math.PI) / 180) > 0;
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, perspective: '1900px', opacity }}>
      <div style={{ position: 'absolute', left: -W / 2, top: -H / 2, width: W, height: H, transformStyle: 'preserve-3d', transform: `rotateY(${rotateY}deg) scale(${scaleVal})` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 52, background: '#050506', backfaceVisibility: 'hidden', opacity: frontVisible ? 1 : 0, transform: `translateZ(${D / 2}px)`, boxShadow: '0 30px 70px rgba(0,0,0,0.28), inset 0 0 0 1.5px rgba(255,255,255,0.35)' }}>
          <div style={{ position: 'absolute', left: SIDE_BEZEL, top: TOP_BEZEL, width: SCREEN_W, height: SCREEN_H, borderRadius: 34, overflow: 'hidden', background: '#000' }}>
            {screen}
          </div>
          <div style={{ position: 'absolute', left: '50%', top: TOP_BEZEL + 16, width: 84, height: 24, marginLeft: -42, borderRadius: 12, background: '#0a0a0c' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 52, background: bezelGrad, backfaceVisibility: 'hidden', opacity: frontVisible ? 0 : 1, transform: `rotateY(180deg) translateZ(${D / 2}px)`, boxShadow: '0 30px 70px rgba(0,0,0,0.28)' }}>
          <div style={{ position: 'absolute', left: 26, top: 30, width: 108, height: 108, borderRadius: 30, background: 'linear-gradient(145deg,#2c2c30,#111113)' }}>
            <div style={{ position: 'absolute', left: 8, top: 8, width: 46, height: 46, borderRadius: '50%', background: lensGrad, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', right: 8, top: 8, width: 46, height: 46, borderRadius: '50%', background: lensGrad, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', left: 8, bottom: 8, width: 46, height: 46, borderRadius: '50%', background: lensGrad, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', right: 16, bottom: 18, width: 14, height: 14, borderRadius: '50%', background: '#e8e2c8' }} />
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: W / 2 - D / 2, width: D, height: H, background: 'linear-gradient(90deg,#b6b6bb,#f0f0f2,#a9a9ae)', transform: `rotateY(90deg) translateZ(${W / 2}px)`, backfaceVisibility: 'hidden', borderRadius: 6 }} />
        <div style={{ position: 'absolute', top: 0, left: W / 2 - D / 2, width: D, height: H, background: 'linear-gradient(90deg,#a9a9ae,#f0f0f2,#b6b6bb)', transform: `rotateY(-90deg) translateZ(${W / 2}px)`, backfaceVisibility: 'hidden', borderRadius: 6 }} />
      </div>
    </div>
  );
}

function Rotate() {
  const { progress } = useScene();
  const e = Easing.easeInOutCubic(progress);
  return <Phone rotateY={180 + e * 180} scaleVal={0.3 + e * 0.7} screen={<PuzzleScreenBase />} />;
}
function PuzzleHold() {
  const { progress } = useScene();
  const fadeIn = Easing.easeOutCubic(clamp(progress / 0.18, 0, 1));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Phone rotateY={0} scaleVal={1} screen={<PuzzleScreenBase />} />
      <FloatingPieceOverlay dy={FLOAT_DY} opacity={fadeIn} flashOpacity={0} />
    </div>
  );
}
function PuzzleDrop() {
  const { progress } = useScene();
  const dropP = clamp(progress / 0.55, 0, 1);
  const de = Easing.easeInOutCubic(dropP);
  const dy = FLOAT_DY * (1 - de);
  let flash = 0;
  if (progress > 0.5 && progress < 0.58) flash = (progress - 0.5) / 0.08;
  else if (progress >= 0.58 && progress < 0.8) flash = 1 - (progress - 0.58) / 0.22;
  flash = clamp(flash, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Phone rotateY={0} scaleVal={1} screen={<PuzzleScreenBase />} />
      <FloatingPieceOverlay dy={dy} opacity={1} flashOpacity={flash} />
    </div>
  );
}
function Reveal() {
  const { progress } = useScene();
  const fadeP = clamp(progress / 0.7, 0, 1);
  const fe = Easing.easeInOutCubic(fadeP);
  const screen = (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - fe }}>
        <PuzzleScreenBase />
        <SettledPiece />
      </div>
      <img src={REVEAL} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: fe }} />
    </div>
  );
  return <Phone rotateY={0} scaleVal={1} screen={screen} />;
}

/* ── minimal transparent scene runner (replaces support.js Stage) ────────── */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const Easing = {
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
};
const SceneContext = createContext(null);
function useScene() { return useContext(SceneContext); }

const SCENES = [
  { name: 'Rotate', dur: 3.6 },
  { name: 'PuzzleHold', dur: 3.0 },
  { name: 'PuzzleDrop', dur: 2.0 },
  { name: 'Reveal', dur: 3.6 },
];
const SCENE_MAP = { Rotate, PuzzleHold, PuzzleDrop, Reveal };
const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);
const STARTS = SCENES.reduce((acc, s) => { acc.push(acc[acc.length - 1] + s.dur); return acc; }, [0]);

export default function HeroPhonePuzzle() {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [time, setTime] = useState(0);

  // Responsive: scale the fixed 1080×1920 canvas to the host width.
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const measure = () => setScale(el.clientWidth / CANVAS_W);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Play once when in view; hold the final Reveal frame. Reduced motion → jump to end.
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setTime(TOTAL); return undefined; }
    const el = hostRef.current;
    let raf = 0, startTs = 0, started = false;
    const tick = (ts) => {
      if (!startTs) startTs = ts;
      const t = (ts - startTs) / 1000;
      if (t >= TOTAL) { setTime(TOTAL); return; }
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started) {
          started = true;
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
      });
    }, { threshold: 0.25 });
    if (el) io.observe(el);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  // Active scene + local progress (progress = localTime / dur, per the design's useScene contract).
  let idx = SCENES.length - 1;
  for (let j = 0; j < SCENES.length; j++) { if (time < STARTS[j + 1]) { idx = j; break; } }
  const wall = clamp(time - STARTS[idx], 0, SCENES[idx].dur);
  const ctx = { progress: SCENES[idx].dur > 0 ? wall / SCENES[idx].dur : 0, index: idx, scene: SCENES[idx] };
  const Comp = SCENE_MAP[SCENES[idx].name];

  return (
    <div className="hero-phone-anim" ref={hostRef} aria-hidden="true">
      <div
        className="hero-phone-anim__canvas"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
      >
        <SceneContext.Provider value={ctx}>
          {Comp ? <Comp /> : null}
        </SceneContext.Provider>
      </div>
    </div>
  );
}
