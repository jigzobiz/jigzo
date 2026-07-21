import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RevealFace from './RevealFace';

/*
 * HeroPhonePuzzle — Refactored with positive stacking context phone glow
 * and SVG-masked single photo puzzle screen base.
 */

const COLS = 3, ROWS = 6;
const CANVAS_W = 1080, CANVAS_H = 1920;
const PHONE_W = 340, PHONE_H = 700;
const SIDE_BEZEL = 6;
const TOP_BEZEL = 6;
const SCREEN_W = PHONE_W - SIDE_BEZEL * 2, SCREEN_H = PHONE_H - TOP_BEZEL * 2;
const CELL_W = SCREEN_W / COLS, CELL_H = SCREEN_H / ROWS;
const FLOAT_DX = 300;
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
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === FR && c === FC) continue;
      list.push({ r, c, d: piecePath(r, c, 0) });
    }
  }
  return list;
})();

const PHOTO = '/assets/demo-photo.png';
const REVEAL = '/assets/demo-reveal.png';
const imgStyle = { position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H, objectFit: 'cover' };

const SettledPiece = React.memo(function SettledPiece({ glowOpacity = 0 }) {
  const d = piecePath(FR, FC, 0);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {/* Snap/Settle edge glows */}
      {glowOpacity > 0.001 && (
        <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', opacity: glowOpacity, zIndex: 0 }}>
          <path d={d} fill="none" stroke="rgba(211,158,69,0.22)" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke="rgba(244,211,142,0.48)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke="rgba(255,250,231,0.95)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}

      {/* Minimal highlight border always active for the settled piece */}
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 1 }}>
        <path d={d} fill="none" stroke="rgba(255,250,231,0.4)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, zIndex: 2 }}>
        <img src={PHOTO} style={imgStyle} />
      </div>
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" />
      </svg>
    </div>
  );
});

function FloatingPieceOverlay({ dx = 0, dy = 0, rot = 0, scale = 1, opacity, flashOpacity }) {
  const d = piecePath(FR, FC, 0);
  return (
    <div style={{ position: 'absolute', left: SCREEN_LEFT, top: SCREEN_TOP, width: SCREEN_W, height: SCREEN_H, opacity, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scale})`, overflow: 'visible', isolation: 'isolate' }}>
      {/* SVG Shape-Following Glow behind the image piece */}
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
        <path d={d} fill="none" stroke="rgba(211,158,69,0.22)" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round" />
        <path d={d} fill="none" stroke="rgba(244,211,142,0.48)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
        <path d={d} fill="none" stroke="rgba(255,250,231,0.95)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, zIndex: 1 }}>
        <img src={PHOTO} style={imgStyle} />
      </div>
      <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
        <path d={d} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.9" />
      </svg>
      {flashOpacity > 0.001 && (
        <div style={{ position: 'absolute', inset: 0, clipPath: `path('${d}')`, background: 'linear-gradient(135deg, #FFE3A0 0%, #E8B04B 45%, #8C5A2B 100%)', opacity: flashOpacity, zIndex: 3 }} />
      )}
    </div>
  );
}

function Phone2D({ scaleX = 1, scaleVal = 1, screenView = 'front', screen }) {
  const W = PHONE_W, H = PHONE_H;
  const bezelGrad = 'linear-gradient(158deg, #efe8d8 0%, #ded5c3 44%, #d1c7b4 72%, #e7dfcd 100%)';
  const lensGrad = 'radial-gradient(circle at 35% 30%, #4a4a50, #0d0d0f 70%)';
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: W,
      height: H,
      marginLeft: -W / 2,
      marginTop: -H / 2,
      transform: `scale(${scaleVal}) scaleX(${scaleX})`,
      transformOrigin: 'center',
      isolation: 'isolate',
      overflow: 'visible',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden'
    }}>
      {/* Glow layer - zIndex: 0 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: 54,
          border: '2px solid rgba(255,250,231,0.92)',
          boxShadow: [
            '0 0 0 5px rgba(244,211,142,0.38)',
            '0 0 0 12px rgba(211,158,69,0.16)',
            '0 0 18px 7px rgba(244,211,142,0.30)',
            '0 0 34px 12px rgba(211,158,69,0.14)'
          ].join(', '),
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'visible'
        }}
      />

      {/* Phone content layer - zIndex: 1 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {screenView === 'front' ? (
          <React.Fragment>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 52, background: '#050506', opacity: BODY_FADE, boxShadow: '0 30px 70px rgba(0,0,0,0.22), inset 0 0 0 1.5px rgba(255,255,255,0.12)' }} />
            <div style={{ position: 'absolute', left: SIDE_BEZEL, top: TOP_BEZEL, width: SCREEN_W, height: SCREEN_H, borderRadius: 34, overflow: 'hidden', background: '#000', isolation: 'isolate', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)', contain: 'paint' }}>
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
    </div>
  );
}

function floatingPieceState(idx, progress, time) {
  const bobX = Math.sin(time * 0.9) * 12;
  const bobY = Math.sin(time * 1.25 + 1.1) * 26;
  if (idx === 0) {
    return { dx: FLOAT_DX + bobX, dy: FLOAT_DY_HOLD + bobY, rot: FLOAT_ROT, scale: 2, flashOpacity: 0 };
  }
  if (idx === 1) {
    const de = Easing.easeInOutCubic(progress);
    const bf = 1 - de;
    let flash = 0;
    if (progress > 0.72 && progress < 0.80) flash = (progress - 0.72) / 0.08;
    else if (progress >= 0.80 && progress < 0.95) flash = 1 - (progress - 0.80) / 0.15;
    return {
      dx: FLOAT_DX * (1 - de) + bobX * bf,
      dy: FLOAT_DY_HOLD * (1 - de) + bobY * bf,
      rot: FLOAT_ROT * (1 - de),
      scale: 2 - de,
      flashOpacity: clamp(flash, 0, 1),
    };
  }
  return null;
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const Easing = {
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
};

const SLOWDOWN = 1.3;
const SCENES = [
  { name: 'Flip', dur: 1.8 },
  { name: 'DriftAndDrop', dur: 2.2 },
  { name: 'Reveal', dur: 3.0 },
  { name: 'LoopOut', dur: 1.0 },
].map((s) => ({ name: s.name, dur: s.dur * SLOWDOWN }));

const LOOP = true;
const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);
const STARTS = SCENES.reduce((acc, s) => { acc.push(acc[acc.length - 1] + s.dur); return acc; }, [0]);

export default function HeroPhonePuzzle() {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [time, setTime] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Preload and decode images before starting animation
  useEffect(() => {
    let active = true;
    const preload = async () => {
      try {
        const p1 = new Image();
        p1.src = PHOTO;
        const p2 = new Image();
        p2.src = REVEAL;

        await Promise.all([
          p1.decode ? p1.decode() : new Promise(r => p1.onload = r),
          p2.decode ? p2.decode() : new Promise(r => p2.onload = r)
        ]);

        if (active) setAssetsLoaded(true);
      } catch (err) {
        console.error('Image pre-decoding failed, using fallback:', err);
        if (active) setAssetsLoaded(true);
      }
    };
    preload();
    return () => { active = false; };
  }, []);

  // Responsive scaling of the fixed canvas
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      setScale(mobile ? Math.min(0.92 * h / PHONE_H, 0.92 * w / PHONE_W) : w / CANVAS_W);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mq = window.matchMedia('(max-width: 760px)');
    mq.addEventListener('change', measure);
    return () => { ro.disconnect(); mq.removeEventListener('change', measure); };
  }, []);

  // Animation Loop
  useEffect(() => {
    if (!assetsLoaded) return undefined;
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
  }, [assetsLoaded]);

  if (!assetsLoaded) {
    return (
      <div className="hero-phone-anim" ref={hostRef} aria-hidden="true" style={{ opacity: 0.3 }} />
    );
  }

  // Active scene state calculation
  let idx = SCENES.length - 1;
  for (let j = 0; j < SCENES.length; j++) { if (time < STARTS[j + 1]) { idx = j; break; } }
  const wall = clamp(time - STARTS[idx], 0, SCENES[idx].dur);
  const progress = SCENES[idx].dur > 0 ? wall / SCENES[idx].dur : 0;

  // Persistent Phone2D transformations
  let scaleX = 1;
  let scaleVal = 1;
  let screenView = 'front';
  let phoneOpacity = 1;

  if (idx === 0) {
    const half = progress < 0.5;
    const localP = clamp(half ? progress / 0.5 : (progress - 0.5) / 0.5, 0, 1);
    const le = Easing.easeInOutCubic(localP);
    scaleX = half ? 1 - le : le;
    if (scaleX < 0.025) scaleX = 0.025; // Clamp scaleX
    scaleVal = half ? 0.3 + 0.7 * le : 1;
    screenView = half ? 'back' : 'front';
  } else if (idx === 3) {
    const fade = Easing.easeInOutCubic(progress);
    phoneOpacity = 1 - fade;
  }

  // Layer Opacities
  let baseOpacity = 1;
  let settledOpacity = 0;
  let revealOpacity = 0;
  let settledGlowOpacity = 0;

  if (idx === 0) {
    baseOpacity = 1;
  } else if (idx === 1) {
    baseOpacity = 1;
    if (progress >= 0.8) {
      settledOpacity = 1;
      settledGlowOpacity = clamp((1 - progress) / 0.2, 0, 1);
    }
  } else if (idx === 2) {
    const fadeP = clamp(progress / 0.4, 0, 1);
    const fe = Easing.easeInOutCubic(fadeP);
    baseOpacity = 1 - fe;
    settledOpacity = 1 - fe;
    revealOpacity = fe;
  } else if (idx === 3) {
    revealOpacity = 1;
  }

  const piece = floatingPieceState(idx, progress, time);

  return (
    <div className="hero-phone-anim" ref={hostRef} aria-hidden="true">
      <div className="hero-phone-anim__bob">
        <div
          className="hero-phone-anim__canvas"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
            opacity: phoneOpacity,
            overflow: 'visible'
          }}
        >
          <Phone2D
            scaleX={scaleX}
            scaleVal={scaleVal}
            screenView={screenView}
            screen={
              <div style={{ position: 'absolute', inset: 0 }}>
                {/* Single Image Puzzle Base */}
                <div style={{ position: 'absolute', inset: 0, opacity: baseOpacity, background: '#141416' }}>
                  <svg
                    width={SCREEN_W}
                    height={SCREEN_H}
                    viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`}
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'block'
                    }}
                  >
                    <defs>
                      <mask
                        id="hero-puzzle-cavity-mask"
                        maskUnits="userSpaceOnUse"
                        maskContentUnits="userSpaceOnUse"
                        x="0"
                        y="0"
                        width={SCREEN_W}
                        height={SCREEN_H}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={SCREEN_W}
                          height={SCREEN_H}
                          fill="white"
                        />
                        <path
                          d={CAVITY_D}
                          fill="black"
                        />
                      </mask>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width={SCREEN_W}
                      height={SCREEN_H}
                      fill="#0e0e10"
                    />
                    <image
                      href={PHOTO}
                      x="0"
                      y="0"
                      width={SCREEN_W}
                      height={SCREEN_H}
                      preserveAspectRatio="xMidYMid slice"
                      mask="url(#hero-puzzle-cavity-mask)"
                    />
                  </svg>
                  <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {STATIC_PIECES.map((p) => (
                      <path key={`s-${p.r}-${p.c}`} d={p.d} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" />
                    ))}
                  </svg>
                </div>

                {/* Settled Piece */}
                <div style={{ position: 'absolute', inset: 0, opacity: settledOpacity, overflow: 'visible' }}>
                  <SettledPiece glowOpacity={settledGlowOpacity} />
                </div>

                {/* Crossfading Reveal — rendered live so the recipient name,
                    sender name, message, font and RTL direction follow the
                    active language instead of being baked into an English PNG.
                    The puzzle photo artwork itself is never mirrored. */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: revealOpacity
                  }}
                >
                  <RevealFace
                    photo={PHOTO}
                    toName={t('demo.toName')}
                    fromName={t('demo.fromName')}
                    message={t('demo.message')}
                  />
                </div>
              </div>
            }
          />

          {piece && (
            <FloatingPieceOverlay
              dx={piece.dx}
              dy={piece.dy}
              rot={piece.rot}
              scale={piece.scale}
              opacity={1}
              flashOpacity={piece.flashOpacity}
            />
          )}
        </div>
      </div>
    </div>
  );
}
