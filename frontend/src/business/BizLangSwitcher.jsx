import React from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';

// Premium language toggle for the business nav. Shows the OTHER language's
// native name and switches without reloading (reuses the shared i18n keys).
export default function BizLangSwitcher({ location = 'business_nav', className = 'biz-lang' }) {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';

  const handleClick = () => {
    if (i18n.language === next) return;
    i18n.changeLanguage(next);
    analytics.track('language_changed', { language: next, location });
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label={t('landing.language.ariaLabel')}
      lang={next}
    >
      {t('landing.language.switchTo')}
    </button>
  );
}
