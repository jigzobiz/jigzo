import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RevealMock from '../components/RevealMock';
import { analytics } from '../services/analytics';
import { getLocalizedPrice, resolveVisitorCurrency } from '../services/jigzoPricing';

const CHECK = (
  <svg className="di" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-warm)', marginTop: 2, flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const FEATURES = [
  'Upload your photo',
  'Write your hidden message',
  'Delivered via WhatsApp',
  'Works on any phone',
  'Save & share after solving',
];

const OCCASIONS = [
  { data: 'birthday', title: 'Birthday', img: 'occasion-birthday.jpg', alt: 'Birthday candle flame on cake', to: '/create?occasion=birthday' },
  { data: 'love', title: 'Love', img: 'occasion-love.jpg', alt: 'Handwritten love note and envelope', to: '/create?occasion=love' },
  { data: 'friendship', title: 'Friendship', img: 'occasion-friendship.jpg', alt: 'Two coffee cups on a table', to: '/create?occasion=justbecause&tone=friendship' },
  { data: 'new-baby', title: 'New Baby', img: 'occasion-newbaby.jpg', alt: 'Pair of tiny baby shoes', to: '/create?occasion=newbaby' },
  { data: 'congratulations', title: 'Congrats', img: 'occasion-congratulations.jpg', alt: 'Graduation cap and tassel', to: '/create?occasion=congrats' },
  { data: 'just-because', title: 'Just Because', img: 'occasion-just-because.jpg', alt: 'Single puzzle piece casting a shadow', to: '/create?occasion=justbecause' },
];

const STEPS = [
  { num: '01', title: 'Upload your photo', body: 'It becomes their puzzle.' },
  { num: '02', title: 'Add your message', body: 'Your words stay hidden until the final piece.' },
  { num: '03', title: 'Send the surprise', body: 'JIGZO delivers it through WhatsApp.' },
];

export default function LandingPage() {
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
  const shortPrice = `From ${price}`;
  const startingPrice = `Starting from ${price}`;

  useEffect(() => {
    analytics.track('landing_viewed');
  }, []);

  return (
    <div className="landing-page">
      {/* ===================== NAV ===================== */}
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" aria-label="Jigzo home">
            <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <Link className="btn btn-ghost nav__btn" to="/create">Create a Surprise</Link>
          <Link className="btn nav__btn-mobile" to="/create">Create</Link>
        </div>
      </header>

      <main id="top">
        {/* ===================== HERO ===================== */}
        <section className="hero">
          {/* Campaign background layers (Mobile, Desktop clear) */}
          <div className="hero__bg-layer">
            <div className="hero__bg-image"></div>
            <img className="hero__bg-image--desktop-clear" src="/assets/assetshomepagehero-composition-reference.png" alt="Two women smiling at a puzzle surprise on their phone" />
            <div className="hero__bg-veil"></div>
          </div>

          {/* Floating trimmed puzzle pieces */}
          <img className="hero-piece hero-piece--02" src="/assets/hero-piece-02-trimmed.png" alt="" aria-hidden="true" />
          <img className="hero-piece hero-piece--03" src="/assets/hero-piece-03-trimmed.png" alt="" aria-hidden="true" />
          <img className="hero-piece hero-piece--04" src="/assets/hero-piece-04-trimmed.png" alt="" aria-hidden="true" />
          <img className="hero-piece hero-piece--05" src="/assets/hero-piece-05-trimmed.png" alt="" aria-hidden="true" />

          <div className="wrap hero__container">
            <div className="hero__content">
              <div className="eyebrow eyebrow--dot"><span></span>A surprise worth uncovering</div>
              <h1 className="hero__headline">
                <span className="hero__headline-line">Don&rsquo;t just send</span>
                <span className="hero__headline-line">the message.</span>
                <span className="hero__headline-line">Let them<span className="hero__headline-desktop-inline"> discover it.</span></span>
                <span className="hero__headline-line hero__headline-mobile-only">discover it.</span>
              </h1>
              <p className="hero__lede">Turn any photo and message into an unforgettable surprise delivered through WhatsApp.</p>
              <div className="hero__cta-wrap">
                <Link className="btn btn-dark" id="hero-cta-btn" to="/create">Create Your Surprise</Link>
                <div className="hero__price-disclosure">
                  Starting from <span data-price-amt>{price}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hero__trust-strip">
            <span>No app needed</span>
            <span className="trust-dot">·</span>
            <span>Ready in minutes</span>
            <span className="trust-dot">·</span>
            <span data-price-short>{shortPrice}</span>
          </div>
        </section>

        {/* ===================== USE CASES / OCCASIONS ===================== */}
        <section className="wrap sec occasions-section">
          <div className="sec__head">
            <span className="eyebrow">Occasions</span>
            <h2>Who would you surprise?</h2>
            <p className="sec__sub">Choose the moment. We&rsquo;ll make the reveal unforgettable.</p>
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
                    <img className="occasion-card__image" src={`/assets/${o.img}`} alt={o.alt} loading="lazy" width="400" height="500" />
                  </div>
                  <div className="occasion-card__overlay">
                    <div className="occasion-card__title">{o.title}</div>
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
              <div className="eyebrow">How JIGZO works</div>
              <h2>Create it in minutes.<br />They&rsquo;ll remember forever.</h2>
              <div className="reveal-band__steps">
                {STEPS.map((s) => (
                  <div className="reveal-band__step" key={s.num}>
                    <span className="reveal-band__step-num">{s.num}</span>
                    <div className="reveal-band__step-text">
                      <div className="reveal-band__step-title">{s.title}</div>
                      <p className="reveal-band__step-body">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="reveal-band__cta-wrap">
                <Link className="btn btn-gold" to="/create">Create Your Surprise</Link>
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
            <span className="eyebrow">Pricing</span>
            <h2>Start with the one that's ready today.</h2>
          </div>
          <div className="tiers">
            <div className="tier tier--active">
              <span className="tier__flag tier__flag--now" style={{ marginBottom: 16 }}>AVAILABLE NOW</span>
              <div className="tier__name">Digital Surprise</div>
              <div className="tier__feats">
                {FEATURES.map((f) => (
                  <div className="tier__feat" key={f}>
                    {CHECK}
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="tier__price-block">
                <div className="tier__price-from">Starting from</div>
                <div className="tier__price-main" data-price-amt>{price}</div>
              </div>
              <Link className="btn btn-gold" to="/create" style={{ width: '100%', marginTop: 0, padding: '16px 20px' }}>Create Your Surprise</Link>
            </div>

            <div className="tier tier--locked">
              <span className="tier__flag tier__flag--soon">Coming soon</span>
              <div className="tier__name">Video Reveal</div>
              <div className="tier__desc">The final piece plays your video: a face, a voice, a moment that moves.</div>
              <button className="tier__notify" type="button">Notify me</button>
            </div>

            <div className="tier tier--locked">
              <span className="tier__flag tier__flag--soon">Coming soon</span>
              <div className="tier__name">Luxury Physical Puzzle</div>
              <div className="tier__desc">Real pieces, boxed and delivered. The reveal you can hold in your hands.</div>
              <button className="tier__notify" type="button">Join the waitlist</button>
            </div>
          </div>
        </section>

        {/* ===================== BUY / low friction ===================== */}
        <section className="wrap sec" id="buy">
          <div className="buy__inner">
            <span className="eyebrow">Send a surprise</span>
            <h2>Make the message something they experience.</h2>
            <p>More memorable than a text. More personal than a greeting card. Ready in minutes.</p>
            <Link className="btn btn-dark" to="/create">Create Your Surprise</Link>
            <div className="buy__cta-fine"><span data-price-starting>{startingPrice}</span> · Delivered through WhatsApp</div>
            <div className="buy__trust">
              <div className="t"><span className="ck">✓</span>Private and personal</div>
              <div className="t"><span className="ck">✓</span>Works on any phone</div>
              <div className="t"><span className="ck">✓</span>Delivered through WhatsApp</div>
              <div className="t"><span className="ck">✓</span><span data-price-starting>{startingPrice}</span></div>
              <div className="t"><span className="ck">✓</span>Edit before sending</div>
            </div>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <img className="footer__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
            <span className="footer__by">Product by Jigpuzzle</span>
          </div>
          <div className="footer__tag">Every surprise deserves a memorable reveal.</div>
          <div className="footer__links">
            <Link className="footer__link" to="/terms">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
