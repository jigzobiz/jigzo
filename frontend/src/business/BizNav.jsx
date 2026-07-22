import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BizLangSwitcher from './BizLangSwitcher';

// Landing-page top navigation. Section links smooth-scroll to in-page anchors;
// the mobile menu is a real focus-manageable drawer. Login links to the demo
// dashboard, clearly tagged. Book a Demo opens the demo-request modal.
const SECTION_LINKS = [
  ['biz-employees', 'business.nav.forEmployees'],
  ['biz-customers', 'business.nav.forCustomers'],
  ['biz-how', 'business.nav.howItWorks'],
  ['biz-examples', 'business.nav.examples'],
  ['biz-packs', 'business.nav.packs'],
];

export default function BizNav({ onBookDemo }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bookDemo = () => { setMenuOpen(false); onBookDemo(); };

  return (
    <header className="biz-nav">
      <div className="biz-nav__inner">
        <div className="biz-nav__brand">
          <Link to="/" aria-label={t('business.nav.home')}>
            <img className="biz-nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <span className="biz-nav__badge">{t('business.nav.badge')}</span>
        </div>

        <nav className="biz-nav__links" aria-label="Primary">
          {SECTION_LINKS.map(([id, key]) => (
            <button key={id} type="button" className="biz-nav__link" onClick={() => goTo(id)}>
              {t(key)}
            </button>
          ))}
        </nav>

        <div className="biz-nav__actions">
          <BizLangSwitcher />
          <Link
            className="biz-nav__login"
            to="/business/dashboard"
            aria-label={`${t('business.nav.login')} — ${t('business.nav.loginTag')}`}
          >
            {t('business.nav.login')}
          </Link>
          <button type="button" className="biz-btn biz-btn--primary biz-btn--sm biz-nav__cta" onClick={onBookDemo}>
            {t('business.nav.bookDemo')}
          </button>
          <button
            type="button"
            className="biz-nav__toggle"
            aria-label={t('business.nav.menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`biz-menu-backdrop ${menuOpen ? 'is-open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div className={`biz-menu ${menuOpen ? 'is-open' : ''}`} role="dialog" aria-modal={menuOpen} aria-label={t('business.nav.menu')} hidden={!menuOpen}>
        <div className="biz-menu__head">
          <span className="biz-nav__badge" style={{ borderInlineStart: 'none', paddingInlineStart: 0 }}>
            JIGZO · {t('business.nav.badge')}
          </span>
          <button type="button" className="biz-menu__close" aria-label={t('business.nav.close')} onClick={() => setMenuOpen(false)}>×</button>
        </div>
        {SECTION_LINKS.map(([id, key]) => (
          <button key={id} type="button" className="biz-menu__link" onClick={() => goTo(id)}>
            {t(key)}
          </button>
        ))}
        <Link className="biz-menu__link" to="/business/dashboard" onClick={() => setMenuOpen(false)}>
          {t('business.nav.login')} · {t('business.nav.loginTag')}
        </Link>
        <div className="biz-menu__actions">
          <BizLangSwitcher location="business_menu" />
          <button type="button" className="biz-btn biz-btn--primary biz-btn--block" onClick={bookDemo}>
            {t('business.nav.bookDemo')}
          </button>
        </div>
      </div>
    </header>
  );
}
