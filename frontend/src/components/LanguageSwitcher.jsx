import React from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';

// Compact, premium language toggle for the landing navigation.
// Shows the OTHER language's native name (English active -> "العربية",
// Arabic active -> "English") and switches without reloading the page.
export default function LanguageSwitcher({ location = 'landing_nav' }) {
  const { t, i18n } = useTranslation();
  const nextLang = i18n.language === 'ar' ? 'en' : 'ar';

  const handleClick = () => {
    if (i18n.language === nextLang) return;
    i18n.changeLanguage(nextLang);
    analytics.track('language_changed', { language: nextLang, location });
  };

  return (
    <button
      type="button"
      className="lang-switch"
      onClick={handleClick}
      aria-label={t('landing.language.ariaLabel')}
      lang={nextLang}
    >
      {t('landing.language.switchTo')}
    </button>
  );
}
