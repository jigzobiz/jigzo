import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RevealMock from '../components/RevealMock';
import HeroPhonePuzzle from '../components/HeroPhonePuzzle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { analytics } from '../services/analytics';
import { getLocalizedPrice, resolveVisitorCurrency } from '../services/jigzoPricing';

const CHECK = (
  <svg className="di" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-warm)', marginTop: 2, flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// Structural (non-translatable) occasion data. Analytics keys (`data`), image
// file names and route targets stay in English/identifiers; the title + alt
// text are resolved from the active locale via `landing.occasions.items.<data>`.
const OCCASIONS = [
  { data: 'birthday', img: 'occasion-birthday.jpg', to: '/create?occasion=birthday' },
  { data: 'love', img: 'occasion-love.jpg', to: '/create?occasion=love' },
  { data: 'friendship', img: 'occasion-friendship.jpg', to: '/create?occasion=justbecause&tone=friendship' },
  { data: 'new-baby', img: 'occasion-newbaby.jpg', to: '/create?occasion=newbaby' },
  { data: 'congratulations', img: 'occasion-congratulations.jpg', to: '/create?occasion=congrats' },
  { data: 'just-because', img: 'occasion-just-because.jpg', to: '/create?occasion=justbecause' },
];

// Decorative step numbers (kept as identifiers, not translated).
const STEP_NUMS = ['01', '02', '03'];

export default function LandingPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState(resolveVisitorCurrency());

  useEffect(() => {
    const handlePricingUpdate = () => {
      setCurrency(resolveVisitorCurrency());
    };
    window.addEventListener('jigzo-pricing-updated', handlePricingUpdate);
    return () => {
      window.removeEventListener('jigzo-pricing-updated', handlePricingUpdate);
    };
  }, []);

  const price = useMemo(() => getLocalizedPrice('digital', currency), [currency]); // e.g. "USD 5"

  // Translated content lists (returnObjects); prices interpolated where needed.
  const steps = t('landing.steps.items', { returnObjects: true });
  const features = t('landing.pricing.digital.features', { returnObjects: true });
  const finalTrust = t('landing.finalCta.trust', { returnObjects: true, price });

  useEffect(() => {
    analytics.track('landing_viewed');
  }, []);

  return (
    <div className="landing-page">
      {/* ===================== NAV ===================== */}
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" aria-label={t('landing.nav.home')}>
            <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <div className="nav__actions">
            <LanguageSwitcher location="landing_nav" />
            <Link className="btn btn-ghost nav__btn" to="/create">{t('landing.nav.createFull')}</Link>
            <Link className="btn nav__btn-mobile" to="/create">{t('landing.nav.create')}</Link>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ===================== HERO ===================== */}
        <section className="hero">
          {/* Campaign background layers (Mobile, Desktop clear) */}
          <div className="hero__bg-layer">
            <div className="hero__bg-image"></div>
            <img className="hero__bg-image--desktop-clear" src="/assets/assetshomepagehero-composition-reference.png" alt={t('landing.hero.bgAlt')} />
            <div className="hero__bg-veil"></div>
          </div>

          {/* Floating trimmed puzzle pieces */}
          <img className="hero-piece hero-piece--02" src="/assets/hero-piece-02-trimmed.png" alt="" aria-hidden="true" />
          <img className="hero-piece hero-piece--03" src="/assets/hero-piece-03-trimmed.png" alt="" aria-hidden="true" />
          <img className="hero-piece hero-piece--04" src="/assets/hero-piece-04-trimmed.png" alt="" aria-hidden="true" />
          <img className="hero-piece hero-piece--05" src="/assets/hero-piece-05-trimmed.png" alt="" aria-hidden="true" />

          {/* Claude Design "Phone Puzzle Reveal" — rotate → jigsaw → drop → reveal */}
          <HeroPhonePuzzle />

          <div className="wrap hero__container">
            <div className="hero__content">
              <div className="eyebrow eyebrow--dot"><span></span>{t('landing.hero.eyebrow')}</div>
              <h1 className="hero__headline">
                <span className="hero__headline-line">{t('landing.hero.headlinePrimary')}</span>
                <span className="hero__headline-line hero__headline-line--italic-gold">{t('landing.hero.headlineAccent')}</span>
              </h1>
              <p className="hero__lede">{t('landing.hero.description')}</p>
              <div className="hero__cta-wrap">
                <Link className="btn btn-dark" id="hero-cta-btn" to="/create">{t('landing.hero.cta', { price })}</Link>
              </div>
            </div>
          </div>
          <div className="hero__trust-strip">
            <span>{t('landing.trust.noApp')}</span>
            <span className="trust-dot">·</span>
            <span>{t('landing.trust.readyInMinutes')}</span>
            <span className="trust-dot">·</span>
            <span data-price-short>{t('landing.trust.fromPrice', { price })}</span>
          </div>
        </section>

        {/* ===================== USE CASES / OCCASIONS ===================== */}
        <section className="wrap sec occasions-section">
          <div className="sec__head">
            <span className="eyebrow">{t('landing.occasions.eyebrow')}</span>
            <h2>{t('landing.occasions.title')}</h2>
            <p className="sec__sub">{t('landing.occasions.subtitle')}</p>
          </div>
          <div className="occasions-carousel-container">
            <div className="occasions-carousel">
              {OCCASIONS.map((o) => (
                <Link
                  key={o.data}
                  className="occasion-card"
                  to={o.to}
                  data-occasion={o.data}
                  onClick={() => analytics.track('occasion_card_click', { occasion: o.data })}
                >
                  <div className="occasion-card__image-wrapper">
                    <img className="occasion-card__image" src={`/assets/${o.img}`} alt={t(`landing.occasions.items.${o.data}.alt`)} loading="lazy" width="400" height="500" />
                  </div>
                  <div className="occasion-card__overlay">
                    <div className="occasion-card__title">{t(`landing.occasions.items.${o.data}.title`)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== THE REVEAL / WALKTHROUGH (climax) ===================== */}
        <section className="reveal-band" id="demo">
          <div className="wrap reveal-band__grid">
            <div className="min0 reveal-band__text">
              <div className="eyebrow">{t('landing.steps.eyebrow')}</div>
              <h2>{t('landing.steps.headingLine1')}<br />{t('landing.steps.headingLine2')}</h2>
              <div className="reveal-band__steps">
                {steps.map((s, i) => (
                  <div className="reveal-band__step" key={STEP_NUMS[i]}>
                    <span className="reveal-band__step-num">{STEP_NUMS[i]}</span>
                    <div className="reveal-band__step-text">
                      <div className="reveal-band__step-title">{s.title}</div>
                      <p className="reveal-band__step-body">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="reveal-band__cta-wrap">
                <Link className="btn btn-gold" to="/create">{t('landing.steps.cta')}</Link>
              </div>
            </div>
            <div className="min0">
              <RevealMock />
            </div>
          </div>
        </section>

        {/* ===================== TIERS ===================== */}
        <section className="wrap sec">
          <div className="sec__head">
            <span className="eyebrow">{t('landing.pricing.eyebrow')}</span>
            <h2>{t('landing.pricing.heading')}</h2>
          </div>
          <div className="tiers">
            <div className="tier tier--active">
              <span className="tier__flag tier__flag--now" style={{ marginBottom: 16 }}>{t('landing.pricing.availableNow')}</span>
              <div className="tier__name">{t('landing.pricing.digital.title')}</div>
              <div className="tier__feats">
                {features.map((f) => (
                  <div className="tier__feat" key={f}>
                    {CHECK}
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="tier__price-block">
                <div className="tier__price-from">{t('landing.pricing.startingFrom')}</div>
                <div className="tier__price-main" data-price-amt>{price}</div>
              </div>
              <Link className="btn btn-gold" to="/create" style={{ width: '100%', marginTop: 0, padding: '16px 20px' }}>{t('landing.pricing.digital.cta')}</Link>
            </div>

            <div className="tier tier--locked">
              <span className="tier__flag tier__flag--soon">{t('landing.pricing.comingSoon')}</span>
              <div className="tier__name">{t('landing.pricing.video.title')}</div>
              <div className="tier__desc">{t('landing.pricing.video.desc')}</div>
              <button className="tier__notify" type="button">{t('landing.pricing.video.notify')}</button>
            </div>

            <div className="tier tier--locked">
              <span className="tier__flag tier__flag--soon">{t('landing.pricing.comingSoon')}</span>
              <div className="tier__name">{t('landing.pricing.physical.title')}</div>
              <div className="tier__desc">{t('landing.pricing.physical.desc')}</div>
              <button className="tier__notify" type="button">{t('landing.pricing.physical.waitlist')}</button>
            </div>
          </div>
        </section>

        {/* ===================== BUY / low friction ===================== */}
        <section className="wrap sec" id="buy">
          <div className="buy__inner">
            <span className="eyebrow">{t('landing.finalCta.eyebrow')}</span>
            <h2>{t('landing.finalCta.heading')}</h2>
            <p>{t('landing.finalCta.description')}</p>
            <Link className="btn btn-dark" to="/create">{t('landing.finalCta.cta')}</Link>
            <div className="buy__cta-fine"><span data-price-starting>{t('landing.finalCta.startingFrom', { price })}</span> · {t('landing.finalCta.deliveredWhatsApp')}</div>
            <div className="buy__trust">
              {finalTrust.map((item, i) => (
                <div className="t" key={i}>
                  <span className="ck">✓</span>
                  {i === 3 ? <span data-price-starting>{item}</span> : <span>{item}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <img className="footer__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
            <span className="footer__by">{t('landing.footer.by')}</span>
          </div>
          <div className="footer__tag">{t('landing.footer.tag')}</div>
          <div className="footer__links">
            <Link className="footer__link" to="/terms">{t('landing.footer.terms')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
