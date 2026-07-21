import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/scroll-concept.css';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

const OCCASIONS = [
  { id: 'birthday', title: 'Birthday', img: 'occasion-birthday.jpg', tagline: 'Make the wish worth waiting for.', to: '/create?occasion=birthday' },
  { id: 'love', title: 'Love', img: 'occasion-love.jpg', tagline: 'Some words deserve a slower reveal.', to: '/create?occasion=love' },
  { id: 'friendship', title: 'Friendship', img: 'occasion-friendship.jpg', tagline: 'Turn a memory into a moment.', to: '/create?occasion=justbecause&tone=friendship' },
  { id: 'congratulations', title: 'Congratulations', img: 'occasion-congratulations.jpg', tagline: 'Let the celebration unfold.', to: '/create?occasion=congrats' },
  { id: 'new-baby', title: 'New Baby', img: 'occasion-newbaby.jpg', tagline: 'The smallest arrival. The biggest surprise.', to: '/create?occasion=newbaby' },
  { id: 'just-because', title: 'Just Because', img: 'occasion-just-because.jpg', tagline: 'No occasion required.', to: '/create?occasion=justbecause' }
];

export default function ScrollConceptPage() {
  const containerRef = useRef(null);
  const guidePieceRef = useRef(null);

  // State to track puzzle reveal and interactive occasions
  const [isPuzzleSnapped, setIsPuzzleSnapped] = useState(false);
  const [activeOccasion, setActiveOccasion] = useState('birthday');

  // Detect if user has prefers-reduced-motion set
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check media query for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleMotionChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  useEffect(() => {
    // If reduced motion is preferred, do not run GSAP scroll triggers
    if (prefersReducedMotion) return;

    // Create GSAP context for safe scoping and clean up
    const ctx = gsap.context(() => {
      const isMobile = window.innerWidth < 1024;

      // Secondary supporting pieces subtle parallax
      gsap.to('.support-piece-1', {
        scrollTrigger: {
          trigger: '.scenes-container',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
        },
        y: '-150px',
        rotation: 45,
      });

      gsap.to('.support-piece-2', {
        scrollTrigger: {
          trigger: '.scenes-container',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
        },
        y: '200px',
        rotation: -60,
      });

      // Main metallic guide piece timeline
      const mainTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.scenes-container',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1, // Smooth scrolling visual guide
        }
      });

      if (!isMobile) {
        // Desktop Cinematic Journey
        mainTl
          // Scene 1 (Hero Float) -> Scene 2 (Something to Uncover)
          .to(guidePieceRef.current, {
            x: '15vw',
            y: '45vh',
            scale: 0.85,
            rotation: -45,
            rotationY: 180,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 2 -> Scene 3 (WhatsApp Message Bubble)
          .to(guidePieceRef.current, {
            x: '55vw',
            y: '60vh',
            scale: 0.9,
            rotation: 35,
            rotationY: 360,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 3 -> Scene 4 (Approaching puzzle stage)
          .to(guidePieceRef.current, {
            x: '25vw',
            y: '48vh',
            scale: 1.15,
            rotation: 180,
            rotationY: 180,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 4 -> Scene 5 (Snap into puzzle center)
          .to(guidePieceRef.current, {
            x: '38vw',
            y: '50vh',
            scale: 0.95,
            rotation: 0,
            rotationY: 0,
            opacity: 0,
            duration: 0.5,
            ease: 'power2.inOut',
            onComplete: () => setIsPuzzleSnapped(true),
            onReverseComplete: () => setIsPuzzleSnapped(false)
          })
          // Keep transparent during reveal details
          .to(guidePieceRef.current, {
            opacity: 0,
            duration: 1
          })
          // Scene 6 (How it works) -> Bring piece back floating
          .to(guidePieceRef.current, {
            x: '80vw',
            y: '30vh',
            scale: 0.8,
            rotation: 45,
            rotationY: 90,
            opacity: 0.3,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 7 (Occasions) -> float lower
          .to(guidePieceRef.current, {
            x: '15vw',
            y: '70vh',
            scale: 0.9,
            rotation: -90,
            rotationY: 180,
            opacity: 0.25,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 8 (Final CTA) -> moves to CTA center
          .to(guidePieceRef.current, {
            x: '50vw',
            y: '35vh',
            scale: 1.0,
            rotation: 15,
            rotationY: 0,
            opacity: 0.9,
            xPercent: -50,
            yPercent: -50,
            duration: 1,
            ease: 'power2.out'
          });
      } else {
        // Mobile Simpler Journey (Avoiding faces, clean & readable)
        mainTl
          // Scene 1 -> Scene 2
          .to(guidePieceRef.current, {
            x: '20vw',
            y: '55vh',
            scale: 0.75,
            rotation: -30,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 2 -> Scene 3
          .to(guidePieceRef.current, {
            x: '65vw',
            y: '70vh',
            scale: 0.8,
            rotation: 45,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 3 -> Scene 4/5
          .to(guidePieceRef.current, {
            x: '50vw',
            y: '62vh',
            xPercent: -50,
            scale: 0.9,
            rotation: 0,
            opacity: 0,
            duration: 1,
            ease: 'power2.inOut',
            onComplete: () => setIsPuzzleSnapped(true),
            onReverseComplete: () => setIsPuzzleSnapped(false)
          })
          // Keep transparent during reveal details
          .to(guidePieceRef.current, {
            opacity: 0,
            duration: 1
          })
          // Scene 6 -> floating subtly
          .to(guidePieceRef.current, {
            x: '75vw',
            y: '30vh',
            scale: 0.6,
            rotation: 45,
            opacity: 0.2,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 7 -> lower float
          .to(guidePieceRef.current, {
            x: '15vw',
            y: '75vh',
            scale: 0.7,
            rotation: -45,
            opacity: 0.15,
            duration: 1,
            ease: 'power1.inOut'
          })
          // Scene 8 -> CTA Center
          .to(guidePieceRef.current, {
            x: '50vw',
            y: '22vh',
            scale: 0.8,
            rotation: 10,
            opacity: 0.8,
            xPercent: -50,
            yPercent: -50,
            duration: 1,
            ease: 'power2.out'
          });
      }

      // Scroll triggers for individual scene animations

      // Scene 1: Reveal second line on slight scroll
      gsap.to('.scene-hook__scroll-reveal', {
        scrollTrigger: {
          trigger: '.scene-hook',
          start: 'top top',
          end: '30% top',
          scrub: true,
        },
        opacity: 1,
        y: 0,
      });

      // Scene 2: Expand photograph
      gsap.to('.scene-uncover__visual', {
        scrollTrigger: {
          trigger: '.scene-uncover',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
        scale: 1.05,
      });

      gsap.to('.puzzle-seams-overlay', {
        scrollTrigger: {
          trigger: '.scene-uncover',
          start: 'top 40%',
          end: 'top 10%',
          scrub: true,
        },
        opacity: 0.35,
      });

      // Scene 3: WhatsApp preview entry
      gsap.to('.whatsapp-bubble', {
        scrollTrigger: {
          trigger: '.scene-surprise',
          start: 'top 70%',
          end: 'top 40%',
          scrub: true,
        },
        opacity: 1,
        y: 0,
        rotationX: 0,
      });

      // Scene 4 & 5 pinning and state updates
      ScrollTrigger.create({
        trigger: '.reveal-pin-section',
        start: 'top top',
        end: 'bottom bottom',
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          // Snap puzzle when scroll reaches 45% of the pinned section
          if (self.progress >= 0.45) {
            setIsPuzzleSnapped(true);
          } else {
            setIsPuzzleSnapped(false);
          }
        }
      });

      // Scene 5: Pulse gold ring inside the completed puzzle
      gsap.fromTo('.gold-pulse', {
        opacity: 0,
        scale: 0.8
      }, {
        scrollTrigger: {
          trigger: '.reveal-pin-section',
          start: '50% top',
          toggleActions: 'play none none reverse'
        },
        opacity: 1,
        scale: 1.3,
        duration: 1.5,
        ease: 'power3.out'
      });

    }, containerRef); // Scoped to page container

    return () => {
      ctx.revert(); // Reverts and cleans up all GSAP & ScrollTrigger instances cleanly
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="scroll-concept-page">
      {/* ===================== PREMIUM NAVIGATION ===================== */}
      <nav className="concept-nav">
        <Link to="/">
          <img className="concept-nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
        </Link>
        <Link className="concept-nav__btn" to="/create">
          Create
        </Link>
      </nav>

      {/* ===================== FLOATING METALLIC VISUAL GUIDE ===================== */}
      <div className="floating-pieces-layer" aria-hidden="true">
        {/* Main metallic piece that travels through the experience */}
        <img
          ref={guidePieceRef}
          className="main-guide-piece"
          src="/assets/hero-piece-05-trimmed.png"
          style={{
            left: prefersReducedMotion ? 'auto' : 0,
            top: prefersReducedMotion ? 'auto' : 0,
            transform: prefersReducedMotion ? 'none' : 'translate3d(75vw, 25vh, 0px) rotate(12deg)'
          }}
          alt=""
        />

        {/* Subtle background decorative pieces */}
        {!prefersReducedMotion && (
          <>
            <img
              className="support-piece support-piece-1"
              src="/assets/hero-piece-02-trimmed.png"
              style={{ left: '10vw', top: '150vh' }}
              alt=""
            />
            <img
              className="support-piece support-piece-2"
              src="/assets/hero-piece-03-trimmed.png"
              style={{ right: '8vw', top: '320vh' }}
              alt=""
            />
          </>
        )}
      </div>

      <div className="scenes-container">
        {/* ===================== SCENE 1 — THE HOOK ===================== */}
        <section className="scene scene-hook">
          <h1 className="hero-headline">
            Don’t just send it.
            <div className="scene-hook__scroll-reveal">
              Let them <span className="font-serif-italic">discover</span> it.
            </div>
          </h1>
          <p className="hero-sub">
            Your photo. Your message.<br />One unforgettable reveal.
          </p>
          <div className="cta-group">
            <Link className="btn-primary" to="/create">
              Create Your JIGZO &middot; AED 19
            </Link>
            <span className="trust-line">No app needed &middot; Ready in minutes</span>
          </div>
        </section>

        {/* ===================== SCENE 2 — SOMETHING TO UNCOVER ===================== */}
        <section className="scene scene-uncover">
          <div className="scene-uncover__text">
            <h2 className="editorial-title">
              Give them something <br />to <span className="font-serif-italic">uncover</span>.
            </h2>
            <p className="editorial-sub">A moment hidden inside every piece.</p>
          </div>
          <div className="scene-uncover__visual">
            <img
              className="uncover-image"
              src="/assets/demo-photo.png"
              alt="Premium lifestyle presentation"
              loading="lazy"
            />
            {/* Elegant puzzle seams */}
            <div className="puzzle-seams-overlay">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="puzzle-seam-cell" />
              ))}
            </div>
          </div>
        </section>

        {/* ===================== SCENE 3 — MESSAGE TO SURPRISE ===================== */}
        <section className="scene scene-surprise">
          <h2 className="editorial-title">
            It arrives like a message.<br />
            But opens like a <span className="font-serif-italic">surprise</span>.
          </h2>
          <div className="whatsapp-preview-container">
            <div className="whatsapp-bubble" style={{ opacity: prefersReducedMotion ? 1 : 0, transform: prefersReducedMotion ? 'none' : undefined }}>
              <div className="whatsapp-bubble__icon">J</div>
              <div className="whatsapp-bubble__content">
                <div className="whatsapp-bubble__header">
                  <span className="whatsapp-bubble__name">JIGZO Delivery</span>
                  <span>Just now</span>
                </div>
                <div className="whatsapp-bubble__text">
                  Someone sent you a surprise puzzle. Tap to uncover it. ✨
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== SCENES 4 & 5 — THE PUZZLE & REVEAL (PINNED) ===================== */}
        <div className="reveal-pin-section">
          <div className="reveal-sticky-container">
            <div className="reveal-grid-container">
              <div className="puzzle-stage">
                <img
                  className={`puzzle-base-image ${isPuzzleSnapped || prefersReducedMotion ? 'is-revealed' : ''}`}
                  src="/assets/demo-photo.png"
                  alt="Puzzle board stage"
                />

                {/* Target placement indicator */}
                <div className={`puzzle-snap-target ${isPuzzleSnapped || prefersReducedMotion ? 'is-snapped' : ''}`}>
                  Final Piece
                </div>

                {/* Snapped piece (rendered locally inside the board once snapped) */}
                {(isPuzzleSnapped || prefersReducedMotion) && (
                  <img
                    className="puzzle-snapped-piece-overlay"
                    src="/assets/hero-piece-05-trimmed.png"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '120px',
                      height: '120px',
                      objectFit: 'contain',
                      animation: 'none'
                    }}
                    alt=""
                  />
                )}

                {/* Light pulse after complete snap */}
                <div className="gold-pulse" style={{ opacity: isPuzzleSnapped ? 1 : 0 }} />

                {/* Reveal message box */}
                <div className={`hidden-message-overlay ${isPuzzleSnapped || prefersReducedMotion ? 'is-visible' : ''}`}>
                  <div className="hidden-message-title">Hidden Message</div>
                  <div className="hidden-message-text">
                    "Happy Birthday! Here is to a beautiful journey ahead. Love you."
                  </div>
                </div>
              </div>

              <div className="reveal-grid-text">
                <h2 className="editorial-title">
                  {isPuzzleSnapped || prefersReducedMotion ? (
                    <>One unforgettable <br /><span className="font-serif-italic">reveal</span>.</>
                  ) : (
                    <>One final <br /><span className="font-serif-italic">piece</span>.</>
                  )}
                </h2>
                <p className="editorial-sub">
                  {isPuzzleSnapped || prefersReducedMotion
                    ? "The puzzle connects, revealing your personal message."
                    : "The user drags or scrolls the last piece into place."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== SCENE 6 — HOW IT WORKS ===================== */}
        <section className="scene scene-how-works">
          <h2 className="editorial-title">
            Made in minutes.<br />
            Remembered much <span className="font-serif-italic">longer</span>.
          </h2>
          <div className="works-grid">
            <div className="works-step">
              <span className="works-step__num">01</span>
              <h3 className="works-step__title">Choose a photo</h3>
              <p className="works-step__body">Upload any memory to become the puzzle they solve.</p>
            </div>
            <div className="works-step">
              <span className="works-step__num">02</span>
              <h3 className="works-step__title">Hide your message</h3>
              <p className="works-step__body">Write your words. They remain hidden until the final piece snaps in.</p>
            </div>
            <div className="works-step">
              <span className="works-step__num">03</span>
              <h3 className="works-step__title">Send the surprise</h3>
              <p className="works-step__body">JIGZO delivers the surprise link directly via WhatsApp.</p>
            </div>
          </div>
          <div className="works-footer">
            Delivered privately through WhatsApp. &middot; No app needed.
          </div>
        </section>

        {/* ===================== SCENE 7 — OCCASIONS ===================== */}
        <section className="scene scene-occasions">
          <h2 className="editorial-title">
            Designed for <span className="font-serif-italic">moments</span>.
          </h2>
          <div className="occasions-viewer">
            <div className="occasions-list">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ.id}
                  className={`occasion-item ${activeOccasion === occ.id ? 'is-active' : ''}`}
                  onClick={() => setActiveOccasion(occ.id)}
                >
                  {occ.title}
                </button>
              ))}
            </div>
            <div className="occasions-display-wrapper">
              {OCCASIONS.map((occ) => (
                <React.Fragment key={occ.id}>
                  <img
                    className={`occasion-image-slide ${activeOccasion === occ.id ? 'is-active' : ''}`}
                    src={`/assets/${occ.img}`}
                    alt={occ.title}
                  />
                  <div className={`occasion-overlay-text ${activeOccasion === occ.id ? 'is-active' : ''}`}>
                    <p className="occasion-tagline">"{occ.tagline}"</p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== SCENE 8 — FINAL CTA ===================== */}
        <section className="scene scene-final-cta">
          <div className="final-cta-container">
            <div className="cta-logo-wrap">
              <img
                className="cta-symbol-jigzo"
                src="/assets/JIGZO-Icon-Beige.png"
                alt="JIGZO Icon"
              />
            </div>
            <h2 className="editorial-title">
              Ready to make their <br /><span className="font-serif-italic">moment</span>?
            </h2>
            <div className="cta-group" style={{ alignItems: 'center' }}>
              <Link className="btn-primary" to="/create">
                Create Your JIGZO &middot; AED 19
              </Link>
              <span className="trust-line">No app needed &middot; Ready in minutes</span>
            </div>
          </div>

          <footer className="concept-footer">
            <div className="concept-footer__brand">
              <strong>JIGZO</strong> &middot; Product by Jigpuzzle
            </div>
            <div className="concept-footer__links">
              <Link to="/terms">Terms of Service</Link>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
