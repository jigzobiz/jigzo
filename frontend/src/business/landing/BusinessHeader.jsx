import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../services/analytics';

export default function BusinessHeader({ onEarlyAccess }) {
  const { t, i18n } = useTranslation();
  const nextLanguage = i18n.language === 'ar' ? 'en' : 'ar';

  const switchLanguage = () => {
    i18n.changeLanguage(nextLanguage);
    analytics.track('language_changed', { language: nextLanguage, location: 'business_nav' });
  };

  return (
    <header className="jzb-header">
      <div className="jzb-shell jzb-header__inner">
        <Link className="jzb-header__brand" to="/" aria-label={t('business.nav.home')}>
          <img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          <span>{t('business.nav.business')}</span>
        </Link>
        <div className="jzb-header__actions">
          <button className="jzb-language" type="button" onClick={switchLanguage} lang={nextLanguage} aria-label={t('business.nav.language')}>
            {t('business.nav.switchLanguage')}
          </button>
          <button className="jzb-button jzb-button--small" type="button" onClick={onEarlyAccess}>
            {t('business.nav.earlyAccess')}
          </button>
        </div>
      </div>
    </header>
  );
}
