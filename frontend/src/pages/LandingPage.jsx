import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeroMock from '../components/HeroMock';
import RevealMock from '../components/RevealMock';
import { analytics } from '../services/analytics';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    analytics.track('landing_viewed');
    
    // Sticky bottom mobile CTA intersection observer logic
    const sticky = document.getElementById('sticky-cta');
    const link = document.getElementById('sticky-cta-link');
    const hero = document.querySelector('.hero');
    if (!sticky || !hero || !link) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          sticky.classList.add('is-visible');
          sticky.setAttribute('aria-hidden', 'false');
          link.removeAttribute('tabindex');
        } else {
          sticky.classList.remove('is-visible');
          sticky.setAttribute('aria-hidden', 'true');
          link.setAttribute('tabindex', '-1');
        }
      });
    }, { threshold: 0 });

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      {/* ===================== NAV ===================== */}
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" aria-label="Jigzo home">
            <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <Link className="btn btn-ghost nav__btn" to="/create">Create Puzzle</Link>
        </div>
      </header>

      <main id="top">
        {/* ===================== HERO ===================== */}
        <section className="hero">
          <div className="wrap hero__grid">
            <div className="min0 hero__content">
              <div className="eyebrow eyebrow--dot"><span></span>A surprise worth uncovering</div>
              <h1 className="hero__headline">Turn any photo into a puzzle that reveals your message.</h1>
              <p className="hero__lede">Upload a photo, add your words, and send it through WhatsApp. They unlock your message with the final piece.</p>
              <div className="hero__cta-wrap">
                <Link className="btn btn-dark" id="hero-cta-btn" to="/create">Create Your Puzzle</Link>
              </div>
              <div className="hero__whatsapp-wrap">
                <a href="#how-it-works" className="hero__whatsapp-link">Delivered instantly through WhatsApp ↓</a>
              </div>
              <div className="hero__trust-row">
                From $5 · Ready in about a minute · Works on any phone
              </div>
              <p className="hero__secondary-line">Some words deserve a moment before they’re read.</p>
            </div>
            <div className="min0 hero__mock-column">
              <HeroMock />
            </div>
          </div>
        </section>

        {/* ===================== HOW IT WORKS ===================== */}
        <section className="wrap sec" id="how-it-works">
          <div className="steps">
            <div className="step">
              <div className="step__num">01</div>
              <div className="step__title">Upload your photo</div>
              <div className="step__body">It becomes their puzzle.</div>
            </div>
            <div className="step">
              <div className="step__num">02</div>
              <div className="step__title">Add your message</div>
              <div className="step__body">Your words stay hidden until the final piece.</div>
            </div>
            <div className="step">
              <div className="step__num">03</div>
              <div className="step__title">Send the surprise</div>
              <div className="step__body">JIGZO delivers it through WhatsApp.</div>
            </div>
          </div>
        </section>

        {/* ===================== USE CASES ===================== */}
        <section className="wrap sec">
          <div className="sec__head">
            <span className="eyebrow">Occasions</span>
            <h2>Made for the moments that matter.</h2>
            <p className="sec__sub">Birthdays, love, friendship, milestones—or no reason at all.</p>
          </div>
          <div className="occasions-wrapper">
            <div className="occasions-chips">
              <div className="chip">Birthday</div>
              <div className="chip">Love</div>
              <div className="chip">Friendship</div>
              <div className="chip">Anniversary</div>
              <div className="chip">Congratulations</div>
              <div className="chip">Thank You</div>
              <div className="chip">Just Because</div>
              <div className="chip">Long Distance</div>
            </div>
          </div>
        </section>

        {/* ===================== THE REVEAL (climax) ===================== */}
        <section className="reveal-band" id="demo">
          <div className="wrap reveal-band__grid">
            <div className="min0 reveal-band__text">
              <div className="eyebrow">Walkthrough</div>
              <h2>From photo to unforgettable reveal.</h2>
              <p className="reveal-band__lede">You create it in minutes. They experience it one piece at a time.</p>
              <div className="reveal-band__cta-wrap">
                <Link className="btn btn-gold" to="/create">Create Your Puzzle</Link>
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
              <span className="tier__flag tier__flag--now">Available now</span>
              <div className="tier__name">Digital JIGZO</div>
              <div className="tier__price">
                <span className="from">Starting from</span>
                <span className="amt">$5</span>
                <span className="unit">one puzzle</span>
              </div>
              <div className="tier__feats">
                <div className="tier__feat"><span class="di">◆</span>Your photo and hidden message</div>
                <div className="tier__feat"><span class="di">◆</span>WhatsApp delivery</div>
                <div className="tier__feat"><span class="di">◆</span>Message revealed after the final piece</div>
                <div className="tier__feat"><span class="di">◆</span>Works on any phone</div>
                <div className="tier__feat"><span class="di">◆</span>Save and share after solving</div>
              </div>
              <Link className="btn btn-gold" to="/create">Create Your Puzzle · Starting from $5</Link>
            </div>
          </div>
          <div className="pricing-future-note">
            More experiences, like Video Reveals and Physical Puzzles, coming later.
          </div>
        </section>

        {/* ===================== BUY / low friction ===================== */}
        <section className="wrap sec" id="buy">
          <div className="buy__inner">
            <span class="eyebrow">Send a surprise</span>
            <h2>Make the message something they experience.</h2>
            <p>More memorable than a text. More personal than a greeting card. Ready in minutes.</p>
            <Link className="btn btn-dark" to="/create">Create Your Puzzle</Link>
            <div className="buy__cta-fine">From $5 · Delivered through WhatsApp</div>
            <div className="buy__trust">
              <div className="t"><span className="ck">✓</span>Private and personal</div>
              <div className="t"><span className="ck">✓</span>Works on any phone</div>
              <div className="t"><span className="ck">✓</span>Delivered through WhatsApp</div>
              <div className="t"><span className="ck">✓</span>From $5</div>
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

      {/* Sticky Bottom CTA (Mobile Only) */}
      <div className="sticky-cta" id="sticky-cta" aria-hidden="true">
        <Link to="/create" className="sticky-cta__link" tabIndex={-1} id="sticky-cta-link">
          <div className="sticky-cta__text-wrap">
            <span className="sticky-cta__title">Create Your Puzzle</span>
            <span className="sticky-cta__price">From $5</span>
          </div>
          <div className="sticky-cta__btn">Go</div>
        </Link>
      </div>
    </div>
  );
}
