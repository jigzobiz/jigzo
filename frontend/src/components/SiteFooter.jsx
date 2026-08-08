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
        <div className="footer__brand-block">
          <div className="footer__brand">
            <img className="footer__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
            <span className="footer__by">{t('landing.footer.by')}</span>
          </div>
          <div className="footer__tag">{t('landing.footer.tag')}</div>
        </div>
        <div className="footer__links">
          <Link className="footer__link footer__link--about" to="/about">{t('landing.footer.about')}</Link>
          <Link className="footer__link footer__link--terms" to="/terms">{t('landing.footer.terms')}</Link>
          <Link className="footer__link" to="/privacy">{t('landing.footer.privacy')}</Link>
          <Link className="footer__link" to="/upload-content">{t('landing.footer.uploadContent')}</Link>
          <Link className="footer__link" to="/refunds">{t('landing.footer.refunds')}</Link>
          <Link className="footer__link" to="/cookies">{t('landing.footer.cookies')}</Link>
        </div>
      </div>
    </footer>
  );
}
