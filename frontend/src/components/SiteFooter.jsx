import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Shared site footer. Extracted from the landing page so the About Us / Terms
// links live in one place and stay consistent across every page that uses it.
export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <img className="footer__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          <span className="footer__by">{t('landing.footer.by')}</span>
        </div>
        <div className="footer__tag">{t('landing.footer.tag')}</div>
        <div className="footer__links">
          <Link className="footer__link" to="/about">{t('landing.footer.about')}</Link>
          <Link className="footer__link" to="/terms">{t('landing.footer.terms')}</Link>
        </div>
      </div>
    </footer>
  );
}
