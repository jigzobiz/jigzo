import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { buildEdgeMap, piecePath } from '../puzzle/puzzle-shape';
import LoaderOrbit from './LoaderOrbit';
import RevealFace from './RevealFace';

export default function RevealMock() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const PHOTO = '/assets/demo-photo.png';
  const MESSAGE = t('demo.message');
  const WA = t('demo.whatsappText');

  const COLS = 4, ROWS = 6, VW = 360, VH = 640, pw = VW / COLS, ph = VH / ROWS;
  const edgeMap = buildEdgeMap(COLS, ROWS, 1337);
  const A = { r: 1, c: 2 }, B = { r: 3, c: 1 };

  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef(null);

  // Seams
  let seamDark = '', seamLight = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tr = `translate(${c * pw} ${r * ph})`;
      const d = piecePath(r, c, COLS, ROWS, pw, ph, edgeMap);
      seamDark += `<path transform="${tr}" d="${d}" fill="none" stroke="rgba(5,5,5,0.28)" stroke-width="2" stroke-linejoin="round"></path>`;
      seamLight += `<path transform="${tr}" d="${d}" fill="none" stroke="rgba(250,248,236,0.5)" stroke-width="1" stroke-linejoin="round"></path>`;
    }
  }

  const slotFill = (p) => {
    return `<path transform="translate(${p.c * pw} ${p.r * ph})" d="${piecePath(p.r, p.c, COLS, ROWS, pw, ph, edgeMap)}" fill="#100e0b" stroke="rgba(250,248,236,0.22)" stroke-width="1.2"></path>`;
  };

  const pieceSvg = (p, id) => {
    const d = piecePath(p.r, p.c, COLS, ROWS, pw, ph, edgeMap);
    return (
      <svg viewBox={`0 0 ${pw} ${ph}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}>
        <defs>
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <image href={PHOTO} x={-p.c * pw} y={-p.r * ph} width={VW} height={VH} preserveAspectRatio="xMidYMid slice" />
        </g>
        <path d={d} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
      </svg>
    );
  };

  const box = (p) => {
    return {
      left: `${(p.c / COLS) * 100}%`,
      top: `${(p.r / ROWS) * 100}%`,
      width: `${100 / COLS}%`,
      height: `${100 / ROWS}%`
    };
  };

  // WhatsApp wallpaper doodle URL
  const doodle = "url(\"data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'>" +
    "<g fill='none' stroke='#CBBBA4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.5'>" +
    "<path d='M22 34c-5-7-16-4-16 4 0 8 16 15 16 15s16-7 16-15c0-8-11-11-16-4z'/>" +
    "<circle cx='112' cy='26' r='12'/><path d='M107 29q5 5 10 0'/>" +
    "<rect x='16' y='96' width='26' height='16' rx='7'/><path d='M42 100h5a3 3 0 0 1 0 8h-5'/><path d='M22 92q2-4 0-7M30 92q2-4 0-7'/>" +
    "<path d='M120 112v-20l12-3v20'/><circle cx='118' cy='114' r='4'/><circle cx='129' cy='111' r='4'/>" +
    "<rect x='60' y='60' width='30' height='20' rx='3'/><circle cx='75' cy='70' r='6'/><path d='M66 60l3-4h12l3 4'/>" +
    "</g></svg>") + "\")";

  const stamp = (() => {
    const now = new Date();
    let hh = now.getHours();
    const ap = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${hh}:${String(now.getMinutes()).padStart(2, '0')} ${ap}`;
  })();

  const capText = t('demo.captions', { returnObjects: true }) || [];
  const durations = [2000, 2000, 2500, 2500, 1000, 4000, 2500];

  useEffect(() => {
    const isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      setActiveIdx(5); // Stay on Scene 6
      return;
    }

    let idx = 0;
    const tick = () => {
      setActiveIdx(idx);
      const d = durations[idx];
      idx = (idx + 1) % durations.length;
      timerRef.current = setTimeout(tick, d);
    };

    tick();

    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="reveal-mock-card">
      <div className="reveal-mock-steps" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
        {capText.map((_, i) => (
          <span key={i} className={`reveal-mock-step ${i === activeIdx ? 'is-active' : ''}`}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="reveal-mock-captions" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
        {capText.map((t, i) => (
          <div key={i} className={`reveal-mock-caption ${i === activeIdx ? 'is-active' : ''}`}>
            {t}
          </div>
        ))}
      </div>
      <div className="reveal-mock-frame">
        <div className="reveal-mock-screen">
          {/* Scene 1 */}
          <div className={`reveal-mock-scene reveal-mock-s1 ${activeIdx === 0 ? 'is-active' : ''}`}>
            <div className="reveal-mock-crop">
              <img src={PHOTO} alt="" draggable="false" />
              <div className="reveal-mock-corner" style={{ top: 10, left: 10, borderBottom: 'none', borderRight: 'none' }}></div>
              <div className="reveal-mock-corner" style={{ top: 10, right: 10, borderBottom: 'none', borderLeft: 'none' }}></div>
              <div className="reveal-mock-corner" style={{ bottom: 10, left: 10, borderTop: 'none', borderRight: 'none' }}></div>
              <div className="reveal-mock-corner" style={{ bottom: 10, right: 10, borderTop: 'none', borderLeft: 'none' }}></div>
            </div>
          </div>

          {/* Scene 2 */}
          <div className={`reveal-mock-scene reveal-mock-s2 ${activeIdx === 1 ? 'is-active' : ''}`} style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
            <div className="reveal-mock-msgcard">
              <div className="reveal-mock-msglabel">{t('create.recipient.messageLabel')}</div>
              <div className="reveal-mock-msgtext">{MESSAGE}</div>
            </div>
          </div>

          {/* Scene 3 */}
          <div className={`reveal-mock-scene reveal-mock-s3 ${activeIdx === 2 ? 'is-active' : ''}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
            <div className="reveal-mock-wa">
              <div className="reveal-mock-wa-head" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
                <div className="reveal-mock-wa-back" style={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}><span className="chev">{isRtl ? '›' : '‹'}</span><span className="n">1</span></div>
                <img className="reveal-mock-wa-av" src="/assets/JIGZO-Icon-Cream.svg" alt="JIGZO" />
                <div className="reveal-mock-wa-name" style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: isRtl ? 'flex-end' : 'flex-start' }}><span className="nm">JIGZO</span><span className="reveal-mock-wa-badge">✓</span></div>
              </div>
              <div className="reveal-mock-wa-body" style={{ backgroundImage: doodle }}>
                <div className="reveal-mock-wa-bubble" style={{
                  borderRadius: isRtl ? "8px 0 8px 8px" : "0 8px 8px 8px",
                  marginRight: isRtl ? 0 : 'auto', marginLeft: isRtl ? 'auto' : 0
                }}>
                  <span className="reveal-mock-wa-tail" style={{
                    left: isRtl ? "auto" : -7, right: isRtl ? -7 : "auto",
                    borderWidth: isRtl ? "0 0 8px 8px" : "0 8px 8px 0",
                    borderColor: isRtl ? "transparent transparent transparent #FFFFFF" : "transparent #FFFFFF transparent transparent"
                  }}></span>
                  {WA}
                  <span className="reveal-mock-wa-time">{stamp}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scene 4 */}
          <div className={`reveal-mock-scene reveal-mock-s4 ${activeIdx === 3 ? 'is-active' : ''}`}>
            <img className="bg" src={PHOTO} alt="" draggable="false" />
            <svg
              className="seams"
              viewBox={`0 0 ${VW} ${VH}`}
              preserveAspectRatio="none"
              dangerouslySetInnerHTML={{ __html: seamDark + seamLight + slotFill(A) + slotFill(B) }}
            />
            <div className="reveal-mock-solvepiece reveal-mock-solve1" style={box(A)}>
              {pieceSvg(A, 'rmkSolveA')}
            </div>
            <div className="reveal-mock-solvepiece reveal-mock-solve2" style={box(B)}>
              {pieceSvg(B, 'rmkSolveB')}
            </div>
          </div>

          {/* Scene 5 */}
          <div className={`reveal-mock-scene reveal-mock-s5 ${activeIdx === 4 ? 'is-active' : ''}`}>
            <div className="reveal-mock-loaderfit">
              <LoaderOrbit />
            </div>
          </div>

          {/* Scene 6 */}
          <div className={`reveal-mock-scene reveal-mock-s6 ${activeIdx === 5 ? 'is-active' : ''}`}>
            <RevealFace photo={PHOTO} toName={t('demo.toName')} fromName={t('demo.fromName')} message={MESSAGE} />
          </div>

          {/* Scene 7 */}
          <div className={`reveal-mock-scene reveal-mock-s7 ${activeIdx === 6 ? 'is-active' : ''}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
            <div className="reveal-mock-s7-card">
              <RevealFace photo={PHOTO} toName={t('demo.toName')} fromName={t('demo.fromName')} message={MESSAGE} />
            </div>
            <div className="reveal-mock-s7-madeA">{t('receive.branding.createdWithCare')}</div>
            <div className="reveal-mock-s7-madeB">{t('receive.branding.madeWithJigzo')}</div>
            <button type="button" tabIndex={-1} aria-hidden="true" className="reveal-mock-s7-btn">
              {t('receive.buttons.saveOrShare')}
            </button>
            <div className="reveal-mock-s7-saved">
              <span className="reveal-mock-s7-check">✓</span>{t('demo.saved')}
            </div>
          </div>

          <div className="reveal-mock-pill"></div>
        </div>
      </div>
    </div>
  );
}
