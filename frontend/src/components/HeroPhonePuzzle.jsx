import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/*
 * HeroPhonePuzzle — Claude Design "Phone Puzzle Reveal" (project
 * "JIGZO Conversion Experience Redesign", file "Phone Puzzle Reveal.dc.html").
 *
 * The scene components below (geometry, Phone2D, PuzzleScreenBase, SettledPiece,
 * FloatingPieceOverlay, Flip/DriftAndDrop/Reveal/LoopOut) are ported VERBATIM
 * from the design's phone-reveal-scene.jsx — only the two asset URLs are pointed
 * at /assets/. The design's own runtime (support.js + animations-v2.jsx) renders
 * inside a dark, shadowed, playback-bar Stage that is unusable as a transparent
 * overlay, so the timeline engine is replaced with the minimal, transparent
 * scene runner at the bottom (same useScene()/Easing/clamp contract, same
 * scenes + looping playback declared in the .dc.html).
 *
 * Page-level adjustments layered on top of the import (not in the design):
 *   1. Scene durations multiplied by SLOWDOWN (1.3) — ~30% calmer.
 *   2. Warm glow matching the hero's floating pieces — in index.css on the layer.
 *   3. Gentle continuous vertical bob — in index.css on .hero-phone-anim__bob.
 */

/* ── geometry (verbatim) ─────────────────────────────────────────────────── */
const COLS = 3, ROWS = 6;
const CANVAS_W = 1080, CANVAS_H = 1920;
const PHONE_W = 340, PHONE_H = 700;
const SIDE_BEZEL = 6;
const TOP_BEZEL = 6;
const SCREEN_W = PHONE_W - SIDE_BEZEL * 2, SCREEN_H = PHONE_H - TOP_BEZEL * 2;
const CELL_W = SCREEN_W / COLS, CELL_H = SCREEN_H / ROWS;
const FLOAT_DX = 480;
const FLOAT_DY_HOLD = -30;
const FLOAT_ROT = -10;
const FR = 3, FC = 1;
const SCREEN_LEFT = CANVAS_W / 2 - PHONE_W / 2 + SIDE_BEZEL;
const SCREEN_TOP = CANVAS_H / 2 - PHONE_H / 2 + TOP_BEZEL;
const BODY_FADE = 0.85;

const edgesV = [[1, -1], [-1, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const edgesH = [[1, -1, 1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, -1]];

function ptAlong(p0, u, n, s, h, dir) {
  return { x: p0.x + u.x * s + n.x * h * dir, y: p0.y + u.y * s + n.y * h * dir };
}

// Mushroom-shaped jigsaw knob: pinched neck then a bulb WIDER than its base,
// so the tab genuinely overhangs (reads as an interlocking knob, not a wave).
// (u, v) are fractions of edge-length / protrusion-height.
const TAB_PTS = [
  { u: 0.35, v: 0 },
  { u: 0.41, v: 0.32 },
  { u: 0.30, v: 0.62 },
  { u: 0.40, v: 0.92 },
  { u: 0.50, v: 1.06 },
  { u: 0.60, v: 0.92 },
  { u: 0.70, v: 0.62 },
  { u: 0.59, v: 0.32 },
  { u: 0.65, v: 0 },
];

function catmullSeg(p0, p1, p2, p3) {
  const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
  const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
  return ` C ${c1.x.toFixed(2)},${c1.y.toFixed(2)} ${c2.x.toFixed(2)},${c2.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
}

function catmullPath(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    d += catmullSeg(p0, p1, p2, p3);
  }
  return d;
}

// One internal edge: straight 35%, mushroom knob across the middle 30%, straight final 35%.
function buildEdgeCmd(p0, p1, dir, hasTab) {
  if (!hasTab) return ` L ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const L = Math.hypot(dx, dy);
  const u = { x: dx / L, y: dy / L };
  const n = { x: -u.y, y: u.x };
  const H = 0.20 * ((CELL_W + CELL_H) / 2);
  const pts = TAB_PTS.map((pt) => ptAlong(p0, u, n, pt.u * L, pt.v * H, dir));
  let d = ` L ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  d += catmullPath(pts);
  d += ` L ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  return d;
}

function piecePath(r, c, dy) {
  const shift = (p) => (dy ? { x: p.x, y: p.y + dy } : p);
  const p = (x, y) => shift({ x, y });
  const topP0 = p(c * CELL_W, r * CELL_H), topP1 = p((c + 1) * CELL_W, r * CELL_H);
  const rightP0 = p((c + 1) * CELL_W, r * CELL_H), rightP1 = p((c + 1) * CELL_W, (r + 1) * CELL_H);
  const botP0 = p((c + 1) * CELL_W, (r + 1) * CELL_H), botP1 = p(c * CELL_W, (r + 1) * CELL_H);
  const leftP0 = p(c * CELL_W, (r + 1) * CELL_H), leftP1 = p(c * CELL_W, r * CELL_H);
  let d = `M ${topP0.x.toFixed(2)},${topP0.y.toFixed(2)}`;
  d += buildEdgeCmd(topP0, topP1, r === 0 ? 1 : edgesH[r - 1][c], r !== 0);
  d += buildEdgeCmd(rightP0, rightP1, c === COLS - 1 ? 1 : edgesV[r][c], c !== COLS - 1);
  d += buildEdgeCmd(botP0, botP1, r === ROWS - 1 ? 1 : -edgesH[r][c], r !== ROWS - 1);
  d += buildEdgeCmd(leftP0, leftP1, c === 0 ? 1 : -edgesV[r][c - 1], c !== 0);
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
// Memoized: the assembled board is identical every frame, so it renders once
// and is reused across the continuous loop instead of rebuilding 18 clip paths.
const PuzzleScreenBase = React.memo(function PuzzleScreenBase() {
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
        {STATIC_PIECES.map((p) => (<path key={`s-${p.r}-${p.c}`} d={p.d} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" />))}
      </svg>
    </div>
  );
});

const SettledPiece = React.memo(function SettledPiece() {
  const d = piecePath(FR, FC, 0);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')` }}>
        <img src={PHOTO} style={imgStyle} />
      </div>
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" />
      </svg>
    </div>
  );
});

function FloatingPieceOverlay({ dx = 0, dy = 0, rot = 0, scale = 1, opacity, flashOpacity }) {
  const d = piecePath(FR, FC, 0);
  const liftT = clamp(Math.abs(dx) / Math.abs(FLOAT_DX), 0, 1);
  return (
    <div style={{ position: 'absolute', left: SCREEN_LEFT, top: SCREEN_TOP, width: SCREEN_W, height: SCREEN_H, opacity, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scale})` }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, filter: `drop-shadow(0 ${10 + liftT * 26}px ${18 + liftT * 34}px rgba(0,0,0,${(0.3 + liftT * 0.25).toFixed(2)}))` }}>
        <img src={PHOTO} style={imgStyle} />
      </div>
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.9" />
      </svg>
      {flashOpacity > 0.001 && (
        <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, background: 'linear-gradient(135deg, #FFE3A0 0%, #E8B04B 45%, #8C5A2B 100%)', opacity: flashOpacity }} />
      )}
    </div>
  );
}

// Flat 2D phone silhouette — matte silver back or bezeled front, no 3D box/side panels.
function Phone2D({ scaleX = 1, scaleVal = 1, screenView = 'front', screen }) {
  const W = PHONE_W, H = PHONE_H;
  const bezelGrad = 'linear-gradient(175deg, #d0d1d4 0%, #c3c4c8 45%, #cfd0d3 100%)';
  const lensGrad = 'radial-gradient(circle at 35% 30%, #4a4a50, #0d0d0f 70%)';
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: `scale(${scaleVal}) scaleX(${scaleX})`, transformOrigin: 'center' }}>
      {screenView === 'front' ? (
        <React.Fragment>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 52, background: '#050506', opacity: BODY_FADE, boxShadow: '0 30px 70px rgba(0,0,0,0.22), inset 0 0 0 1.5px rgba(255,255,255,0.12)' }} />
          <div style={{ position: 'absolute', left: SIDE_BEZEL, top: TOP_BEZEL, width: SCREEN_W, height: SCREEN_H, borderRadius: 34, overflow: 'hidden', background: '#000' }}>
            {screen}
          </div>
          <div style={{ position: 'absolute', left: '50%', top: TOP_BEZEL + 16, width: 84, height: 24, marginLeft: -42, borderRadius: 12, background: '#0a0a0c', opacity: BODY_FADE }} />
        </React.Fragment>
      ) : (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 52, background: bezelGrad, opacity: BODY_FADE, boxShadow: '0 24px 54px rgba(0,0,0,0.18)' }}>
          <div style={{ position: 'absolute', left: 26, top: 30, width: 108, height: 108, borderRadius: 30, background: 'linear-gradient(145deg,#2c2c30,#111113)' }}>
            <div style={{ position: 'absolute', left: 8, top: 8, width: 46, height: 46, borderRadius: '50%', background: lensGrad, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', right: 8, top: 8, width: 46, height: 46, borderRadius: '50%', background: lensGrad, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', left: 8, bottom: 8, width: 46, height: 46, borderRadius: '50%', background: lensGrad, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ position: 'absolute', right: 16, bottom: 18, width: 14, height: 14, borderRadius: '50%', background: '#e8e2c8' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Flat 2D flip: back squashes (scaleX 1→0) while growing to full size, swaps to
// front at the thin moment, then front expands (scaleX 0→1) at full size.
function Flip() {
  const { progress } = useScene();
  const half = progress < 0.5;
  const localP = clamp(half ? progress / 0.5 : (progress - 0.5) / 0.5, 0, 1);
  const le = Easing.easeInOutCubic(localP);
  const scaleX = half ? 1 - le : le;
  const scaleVal = half ? 0.3 + 0.7 * le : 1;
  return <Phone2D scaleX={scaleX} scaleVal={scaleVal} screenView={half ? 'back' : 'front'} screen={<PuzzleScreenBase />} />;
}

// Merged hold+drop: the piece is already drifting in (2x size) as the flip
// finishes, and glides straight into its slot while shrinking to grid size.
function DriftAndDrop() {
  const { progress } = useScene();
  const de = Easing.easeInOutCubic(progress);
  const dx = FLOAT_DX * (1 - de);
  const dy = FLOAT_DY_HOLD * (1 - de);
  const rot = FLOAT_ROT * (1 - de);
  const pieceScale = 2 - de;
  let flash = 0;
  if (progress > 0.72 && progress < 0.80) flash = (progress - 0.72) / 0.08;
  else if (progress >= 0.80 && progress < 0.95) flash = 1 - (progress - 0.80) / 0.15;
  flash = clamp(flash, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Phone2D screenView="front" screen={<PuzzleScreenBase />} />
      <FloatingPieceOverlay dx={dx} dy={dy} rot={rot} scale={pieceScale} opacity={1} flashOpacity={flash} />
    </div>
  );
}
function Reveal() {
  const { progress } = useScene();
  const fadeP = clamp(progress / 0.4, 0, 1);
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
  return <Phone2D screenView="front" screen={screen} />;
}
function LoopOut() {
  const { progress } = useScene();
  const fade = Easing.easeInOutCubic(progress);
  const screen = <img src={REVEAL} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - fade }}>
      <Phone2D screenView="front" screen={screen} />
    </div>
  );
}

/* ── minimal transparent scene runner (replaces support.js Stage) ────────── */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const Easing = {
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
};
const SceneContext = createContext(null);
function useScene() { return useContext(SceneContext); }

// Adjustment 1: multiply every authored scene duration by 1.3 (~30% slower).
const SLOWDOWN = 1.3;
const SCENES = [
  { name: 'Flip', dur: 1.8 },
  { name: 'DriftAndDrop', dur: 2.2 },
  { name: 'Reveal', dur: 3.0 },
  { name: 'LoopOut', dur: 1.0 },
].map((s) => ({ name: s.name, dur: s.dur * SLOWDOWN }));
const SCENE_MAP = { Flip, DriftAndDrop, Reveal, LoopOut };
const LOOP = true; // design's OM_PLAYBACK is {mode:loop}
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

  // Loop continuously (design's OM_PLAYBACK is {mode:loop}); run the rAF only
  // while the hero is on screen. Reduced motion → freeze on the static reveal.
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      const rIdx = SCENES.findIndex((s) => s.name === 'Reveal');
      setTime(STARTS[rIdx] + SCENES[rIdx].dur * 0.9);
      return undefined;
    }
    const el = hostRef.current;
    let raf = 0, lastTs = 0, acc = 0;
    const tick = (ts) => {
      if (!lastTs) lastTs = ts;
      acc += (ts - lastTs) / 1000;
      lastTs = ts;
      if (!LOOP && acc >= TOTAL) { raf = 0; setTime(TOTAL - 0.001); return; }
      setTime(LOOP ? acc % TOTAL : acc);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) { lastTs = 0; raf = requestAnimationFrame(tick); } };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) start(); else stop(); });
    }, { threshold: 0.05 });
    if (el) io.observe(el);
    return () => { stop(); io.disconnect(); };
  }, []);

  // Active scene + local progress (progress = localTime / dur, per useScene contract).
  let idx = SCENES.length - 1;
  for (let j = 0; j < SCENES.length; j++) { if (time < STARTS[j + 1]) { idx = j; break; } }
  const wall = clamp(time - STARTS[idx], 0, SCENES[idx].dur);
  const ctx = { progress: SCENES[idx].dur > 0 ? wall / SCENES[idx].dur : 0, index: idx, scene: SCENES[idx] };
  const Comp = SCENE_MAP[SCENES[idx].name];

  return (
    <div className="hero-phone-anim" ref={hostRef} aria-hidden="true">
      <div className="hero-phone-anim__bob">
        <div
          className="hero-phone-anim__canvas"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
        >
          <SceneContext.Provider value={ctx}>
            {Comp ? <Comp /> : null}
          </SceneContext.Provider>
        </div>
      </div>
    </div>
  );
}
