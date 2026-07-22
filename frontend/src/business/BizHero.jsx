import React from 'react';
import { useTranslation } from 'react-i18next';
import BizPhone from './BizPhone';

// Animated hero composition (CSS + SVG + React). The staged reveal plays once:
// campaign card fades in, recipient names pop, golden puzzle trails draw toward
// two phones (employee solving / customer reward), and the live-engagement panel
// resolves last. prefers-reduced-motion collapses every stage to its end state
// (handled in business.css) so the final composition is always readable.
const HERO_NAMES = ['Sara A.', 'Yousif N.', 'Mariam S.', 'Ahmed R.', 'Lina K.', '+496'];
const HERO_BARS = [45, 65, 58, 88, 70];

export default function BizHero({ onBookDemo, onWatch }) {
  const { t } = useTranslation();

  return (
    <section className="biz-hero">
      <div className="biz-hero__inner">
        <div className="biz-hero__copy">
          <p className="biz-eyebrow biz-eyebrow--on-dark">{t('business.hero.eyebrow')}</p>
          <h1>{t('business.hero.headline')}</h1>
          <p className="biz-hero__lede">{t('business.hero.lede')}</p>
          <div className="biz-hero__cta">
            <button type="button" className="biz-btn biz-btn--on-dark" onClick={onBookDemo}>
              {t('business.hero.ctaPrimary')}
            </button>
            <button type="button" className="biz-btn biz-btn--ghost-dark" onClick={onWatch}>
              {t('business.hero.ctaSecondary')}
            </button>
          </div>
        </div>

        <div className="biz-hero__stage" aria-hidden="true">
          <div className="biz-heroanim">
            <svg className="biz-heroanim__trails" viewBox="0 0 560 480" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="bizTrail" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F6DC93" />
                  <stop offset="45%" stopColor="#D0A036" />
                  <stop offset="100%" stopColor="#7C4C22" />
                </linearGradient>
              </defs>
              <path className="biz-heroanim__trail biz-heroanim__trail--1" d="M250 128 C 180 170, 130 200, 108 262" />
              <path className="biz-heroanim__trail biz-heroanim__trail--2" d="M312 128 C 390 170, 430 200, 452 262" />
            </svg>

            {/* campaign card */}
            <div className="biz-heroanim__card">
              <div className="biz-heroanim__card-head">
                <img className="biz-heroanim__card-ico" src="/assets/JIGZO-Icon-Beige.png" alt="" />
                <span className="biz-heroanim__card-org">{t('business.hero.cardOrg')}</span>
              </div>
              <div className="biz-heroanim__card-title">{t('business.hero.cardTitle')}</div>
              <div className="biz-heroanim__card-sub">{t('business.hero.cardSub')}</div>
              <div className="biz-heroanim__names">
                {HERO_NAMES.map((n, i) => (
                  <span key={n} className="biz-heroanim__name biz-ltr" style={{ animationDelay: `${0.9 + i * 0.12}s` }}>{n}</span>
                ))}
              </div>
            </div>

            {/* analytics panel */}
            <div className="biz-heroanim__analytics">
              <div className="biz-heroanim__analytics-head">
                <span className="biz-heroanim__analytics-label">{t('business.hero.analyticsLabel')}</span>
                <span className="biz-heroanim__analytics-pct biz-ltr">72%</span>
              </div>
              <div className="biz-heroanim__bars">
                {HERO_BARS.map((h, i) => (
                  <span
                    key={i}
                    className={`biz-heroanim__bar ${i === 3 ? 'biz-heroanim__bar--hi' : ''}`}
                    style={{ height: `${h}%`, animationDelay: `${3.1 + i * 0.08}s` }}
                  />
                ))}
              </div>
            </div>

            {/* employee phone — solving */}
            <BizPhone className="biz-heroanim__phone biz-heroanim__phone--emp">
              <div className="biz-scr biz-scr--dark biz-scr--pad">
                <span className="biz-scr__org">{t('business.hero.empName')}</span>
                <div className="biz-scr__puzzle">
                  {[1, 0, 0, 1, 0, 0].map((f, i) => (
                    <span key={i} className={`biz-scr__pc ${f ? 'biz-scr__pc--filled' : ''}`} />
                  ))}
                </div>
                <span className="biz-scr__hint">{t('business.hero.empPieces')}</span>
              </div>
            </BizPhone>

            {/* customer phone — reward reveal */}
            <BizPhone className="biz-heroanim__phone biz-heroanim__phone--cus">
              <div className="biz-scr biz-scr--reveal biz-scr--pad">
                <img className="biz-scr__ico" src="/assets/JIGZO-Icon-Gradient1.png" alt="" />
                <div className="biz-scr__reveal-title">{t('business.hero.cusReveal')}</div>
                <div className="biz-scr__reveal-msg">{t('business.hero.cusOffer')}</div>
              </div>
            </BizPhone>
          </div>
        </div>
      </div>
    </section>
  );
}
