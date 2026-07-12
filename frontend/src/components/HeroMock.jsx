import React, { useState, useEffect, useRef } from 'react';
import { buildEdgeMap, piecePath } from '../puzzle/puzzle-shape';

export default function HeroMock() {
  const PHOTO = '/assets/demo-photo.png';
  const REVEAL = '/assets/demo-reveal.png';
  const COLS = 4, ROWS = 6, VW = 360, VH = 640;
  const pw = VW / COLS, ph = VH / ROWS;
  const MR = 1, MC = 2; // missing piece coordinates

  const [state, setState] = useState('a'); // 'a' or 'b'
  const [solving, setSolving] = useState(false);
  const tRef = useRef(null);

  const edgeMap = buildEdgeMap(COLS, ROWS, 1337);

  // Build static seams
  let dark = '', light = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tr = `translate(${c * pw} ${r * ph})`;
      const d = piecePath(r, c, COLS, ROWS, pw, ph, edgeMap);
      dark += `<path transform="${tr}" d="${d}" fill="none" stroke="rgba(5,5,5,0.22)" stroke-width="2" stroke-linejoin="round"></path>`;
      light += `<path transform="${tr}" d="${d}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1" stroke-linejoin="round"></path>`;
    }
  }

  const slotD = piecePath(MR, MC, COLS, ROWS, pw, ph, edgeMap);
  const slotTr = `translate(${MC * pw} ${MR * ph})`;
  const slotFill = `<path transform="${slotTr}" d="${slotD}" fill="#ECE3D0" stroke="rgba(5,5,5,0.15)" stroke-width="1.2"></path>`;

  // Curved gold arrow with white outline
  const arrowCurve = 'M80 8 C 96 42 78 92 36 108';
  const arrowHead = 'M36 108 L 51 105 M36 108 L 41 92';

  const toggleState = () => {
    const isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (state === 'a') {
      setState('b');
      setSolving(true);
      clearTimeout(tRef.current);
      tRef.current = setTimeout(() => {
        setSolving(false);
      }, isReduced ? 0 : 1000);
    } else {
      setState('a');
      setSolving(true);
      clearTimeout(tRef.current);
      tRef.current = setTimeout(() => {
        setSolving(false);
      }, isReduced ? 0 : 500);
    }
  };

  useEffect(() => {
    return () => clearTimeout(tRef.current);
  }, []);

  const cardClasses = [
    'hero-mock-card',
    state === 'b' ? 'is-b' : '',
    solving ? 'is-solving' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={0}
      aria-label="Interactive jigsaw puzzle demo. Press space or enter to solve or replay."
      onClick={toggleState}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleState();
        }
      }}
    >
      <div className="hero-mock-hint">Tap to replay</div>
      <div className="hero-mock-frame">
        <div className="hero-mock-screen">
          <div className="hero-mock-a">
            <img className="hero-mock-photo" src={PHOTO} alt="" draggable="false" />
            <svg
              className="hero-mock-seams"
              viewBox={`0 0 ${VW} ${VH}`}
              preserveAspectRatio="none"
              dangerouslySetInnerHTML={{ __html: dark + light + slotFill }}
            />
            <div
              className="hero-mock-piece"
              style={{
                left: `${(MC / COLS) * 100}%`,
                top: `${(MR / ROWS) * 100}%`,
                width: `${100 / COLS}%`,
                height: `${100 / ROWS}%`
              }}
            >
              <div className="hero-mock-piece-bob">
                <svg className="hero-mock-piece-svg" viewBox={`0 0 ${pw} ${ph}`} preserveAspectRatio="none">
                  <defs>
                    <clipPath id="hmkClip">
                      <path d={slotD} />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#hmkClip)">
                    <image href={PHOTO} x={-MC * pw} y={-MR * ph} width={VW} height={VH} preserveAspectRatio="xMidYMid slice" />
                  </g>
                  <path d={slotD} fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="hero-mock-b">
            <img className="hero-mock-reveal-img" src={REVEAL} alt="" draggable="false" />
          </div>
          <div className="hero-mock-pill"></div>
        </div>
        <div className="hero-mock-tap">
          <svg className="hero-mock-arrow" viewBox="0 0 100 120" fill="none" aria-hidden="true">
            <path d={arrowCurve} stroke="#FFFFFF" strokeWidth="5.4" strokeLinecap="round" />
            <path d={arrowHead} stroke="#FFFFFF" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d={arrowCurve} stroke="#8a6d3a" strokeWidth="3" strokeLinecap="round" />
            <path d={arrowHead} stroke="#8a6d3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hero-mock-tap-label">Tap Me</span>
        </div>
      </div>
    </div>
  );
}
