import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

// Shared site navigation. Extracted from the (previously duplicated) markup on
// the landing and terms pages so every page renders the exact same header.
// The mobile/desktop button swap is driven by CSS scoped to `.landing-page`,
// so on other pages the full "Create a Surprise" ghost button shows at all
// widths, matching the prior standalone terms-page nav.
export default function SiteHeader({ switcherLocation }) {
  const { t } = useTranslation();

  return (
    <header className="nav">
      <div className="nav__inner">
        <Link to="/" aria-label={t('landing.nav.home')}>
          <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
        </Link>
        <div className="nav__actions">
          <LanguageSwitcher location={switcherLocation} />
          <Link className="btn btn-ghost nav__btn" to="/create">{t('landing.nav.createFull')}</Link>
          <Link className="btn nav__btn-mobile" to="/create">{t('landing.nav.create')}</Link>
        </div>
      </div>
    </header>
  );
}
