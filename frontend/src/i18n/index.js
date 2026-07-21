import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.js';
import ar from './locales/ar.js';

// Supported languages. English is the safe default and the only fallback.
export const SUPPORTED_LANGUAGES = ['en', 'ar'];
export const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'jigzo_language';

// Resolve the initial language:
//   1. A previously saved preference in localStorage wins.
//   2. Otherwise inspect the browser language — use Arabic only when it
//      begins with "ar"; every other case falls back to English.
function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }
  } catch (e) {
    /* localStorage unavailable — fall through to browser detection */
  }

  try {
    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browserLang.startsWith('ar')) {
      return 'ar';
    }
  } catch (e) {
    /* navigator unavailable — fall through to default */
  }

  return DEFAULT_LANGUAGE;
}

const initialLanguage = detectInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: {
      escapeValue: false, // React already escapes against XSS
    },
    returnObjects: true, // arrays/objects (steps, features, trust lists)
    react: {
      useSuspense: false, // resources are bundled/synchronous — no Suspense
    },
  });

// Apply document-level side effects for a given language: persistence, the
// <html lang>/<html dir> attributes, and the localized <title>/meta description.
export function applyLanguageSideEffects(lng) {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';

  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch (e) {
    /* ignore persistence failures (private mode, etc.) */
  }

  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    html.setAttribute('lang', lng);
    html.setAttribute('dir', dir);

    const title = i18n.getFixedT(lng)('meta.title');
    if (title) document.title = title;

    const description = i18n.getFixedT(lng)('meta.description');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && description) metaDesc.setAttribute('content', description);
  }
}

// Run once for the initial language, then on every subsequent change.
applyLanguageSideEffects(i18n.language);
i18n.on('languageChanged', applyLanguageSideEffects);

export default i18n;
