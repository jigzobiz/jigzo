import React, { useEffect, useMemo, useState, useId } from 'react';
import { buildEdgeMap, mulberry32, piecePath } from '../../puzzle/puzzle-shape';
import { BUSINESS_PUZZLE_GEOMETRY } from '../../puzzle/puzzle-geometry';
import BusinessPuzzle from '../landing/BusinessPuzzle';
import SolvedInvitationFrame from './SolvedInvitationFrame';

const { board: BOARD, grid: GRID } = BUSINESS_PUZZLE_GEOMETRY;
const ENVELOPE_X = BOARD.width / 2;
const ENVELOPE_Y = BOARD.height / 2;
// Max spread of per-piece stagger, small relative to the ~1s spill window and the 1.8s
// assembly window it also (slightly) offsets — enough to keep a large piece count (28)
// from spilling as one simultaneous blob, without desyncing when everyone finishes
// assembling and the completed puzzle needs to read as genuinely complete.
const MAX_STAGGER_S = 0.5;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else mq.removeListener(onChange); };
  }, []);
  return reduced;
}

// One continuous 8s CSS animation loop (no JS timers/state-driven scene swaps) —
// envelope arrival -> open -> ALL selected pieces spill/pile -> those SAME pieces
// assemble onto their real BUSINESS_PUZZLE_GEOMETRY grid slots -> (now already the
// completed puzzle, no separate component swapped in) -> reveal transition ->
// invitation + RSVP resolve into place on the solved image, hold, then loop. Every
// moving element is a single persistent DOM node whose CSS custom properties drive one
// shared @keyframes timeline (business-journey.css) — the motion itself carries the
// progression, and the pieces that assemble ARE the finished puzzle, not a stand-in
// that gets swapped for a separately-rendered one.
export default function PhoneJourneyAnimation({ pieceCount, imageUrl, mysteryMode, eventTitle, whenDisplay, location, message, rsvpEnabled, allowPlusOne, copy, revealedCopy, isArabic }) {
  const reduced = useReducedMotion();
  const clipBase = useId().replace(/:/g, '');
  const showImage = Boolean(imageUrl && !mysteryMode);

  const layout = GRID[pieceCount] || GRID[18];
  const pieces = useMemo(() => {
    const pieceW = BOARD.width / layout.cols;
    const pieceH = BOARD.height / layout.rows;
    const total = layout.cols * layout.rows;
    // Same edge-map seed formula BusinessPuzzle.jsx uses (407 + pieceCount) so the
    // silhouettes the animation assembles are visually identical to the actual
    // completed-puzzle rendering elsewhere in Studio — not an independently invented shape.
    const edges = buildEdgeMap(layout.cols, layout.rows, 407 + pieceCount);
    const rand = mulberry32(9001 + pieceCount);
    return Array.from({ length: total }, (_, index) => {
      const row = Math.floor(index / layout.cols);
      const col = index % layout.cols;
      const finalX = col * pieceW;
      const finalY = row * pieceH;
      return {
        index,
        path: piecePath(row, col, layout.cols, layout.rows, pieceW, pieceH, edges),
        finalX,
        finalY,
        // The outer <g> is statically placed at the piece's true final position (needed
        // so the image clip always samples the right slice — see below). These are
        // OFFSETS from that final position, not absolute coordinates, so the CSS
        // transform can animate spawn -> pile -> (0,0) i.e. back to the static final spot.
        spawnX: ENVELOPE_X - finalX,
        spawnY: ENVELOPE_Y - finalY,
        pileX: 20 + rand() * (BOARD.width - 40) - finalX,
        pileY: 16 + rand() * (BOARD.height - 32) - finalY,
        pileRot: (rand() - 0.5) * 50,
        delay: -((index / total) * MAX_STAGGER_S)
      };
    });
  }, [layout, pieceCount]);

  if (reduced) {
    // No flying/falling/assembling motion, no continuous loop — one calm, representative
    // frame: the actual selected puzzle (respecting Mystery Mode) with the teaser below,
    // exactly what the "solve" moment looks like without any of the surrounding motion.
    return <div className="jzj-anim jzj-anim--reduced" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="jzj-anim-stage">
        <BusinessPuzzle finalPiece={-1} pieceCount={pieceCount} imageUrl={imageUrl} mysteryMode={mysteryMode} />
      </div>
      <p className="jzj-anim-teaser jzj-anim-teaser--static">{copy.arrivalTeaser}</p>
    </div>;
  }

  return <div className="jzj-anim" dir={isArabic ? 'rtl' : 'ltr'}>
    <div className="jzj-anim-stage">
      <svg className="jzj-anim-pieces" viewBox={`0 0 ${BOARD.width} ${BOARD.height}`} aria-hidden="true">
        {pieces.map((piece) => {
          const clipId = `jzj-anim-clip-${clipBase}-${piece.index}`;
          return (
            <g
              key={piece.index}
              className="jzj-anim-piece"
              style={{
                '--spawn-x': `${piece.spawnX}px`, '--spawn-y': `${piece.spawnY}px`,
                '--pile-x': `${piece.pileX}px`, '--pile-y': `${piece.pileY}px`, '--pile-rot': `${piece.pileRot}deg`,
                animationDelay: `${piece.delay}s`
              }}
              transform={`translate(${piece.finalX} ${piece.finalY})`}
            >
              {showImage ? (
                <>
                  {/* Mystery OFF: this piece's clip is defined in its own local (final-slot)
                      coordinate frame, and the outer <g> above already sits at that final
                      position — so the <image>, offset backward by the same amount, always
                      reveals exactly the slice of the photo that belongs at this piece's
                      real grid location. The animated inner wrapper below then carries BOTH
                      the clip and the image together as it moves pile<->final, so the
                      correct slice follows the piece instead of a mismatched crop. */}
                  <clipPath id={clipId}><path d={piece.path} /></clipPath>
                  <g className="jzj-anim-piece__move">
                    <g clipPath={`url(#${clipId})`}>
                      <image href={imageUrl} x={-piece.finalX} y={-piece.finalY} width={BOARD.width} height={BOARD.height} preserveAspectRatio="xMidYMid slice" />
                    </g>
                  </g>
                </>
              ) : (
                <g className="jzj-anim-piece__move"><path className="jzj-anim-piece__fill" d={piece.path} /></g>
              )}
            </g>
          );
        })}
      </svg>
      <svg className="jzj-anim-envelope" viewBox="0 0 288 192" aria-hidden="true">
        <g className="jzj-anim-envelope__group" transform="translate(94 76)">
          <path className="jzj-arrival__envelope-body" d="M0 10 L50 10 L100 10 L100 62 L0 62 Z" />
          <path className="jzj-arrival__envelope-flap" d="M0 10 L50 46 L100 10" />
        </g>
      </svg>
      <div className="jzj-anim-reveal">
        <SolvedInvitationFrame
          mode="static"
          compact
          imageUrl={imageUrl}
          eventTitle={eventTitle}
          whenDisplay={whenDisplay}
          location={location}
          message={message}
          rsvpDeadlineDisplay=""
          rsvpEnabled={rsvpEnabled}
          allowPlusOne={allowPlusOne}
          copy={revealedCopy}
          isArabic={isArabic}
        />
      </div>
    </div>
    <p className="jzj-anim-teaser">{copy.arrivalTeaser}</p>
  </div>;
}
