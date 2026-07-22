import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Route-specific <title>/description for the JIGZO Business pages.
//
// The consumer i18n layer (applyLanguageSideEffects) rewrites document.title
// to `meta.title` on every language change. This hook depends on i18n.language
// so it re-runs AFTER that handler and re-applies the business title, keeping
// the business routes correct in both languages without touching the global
// consumer metadata. On unmount it restores the consumer title.
export function useBizMeta(titleKey, descKey) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const title = t(titleKey);
    if (title) document.title = title;

    const metaDesc = descKey ? document.querySelector('meta[name="description"]') : null;
    const prevDesc = metaDesc ? metaDesc.getAttribute('content') : null;
    if (metaDesc) {
      const desc = t(descKey);
      if (desc) metaDesc.setAttribute('content', desc);
    }

    return () => {
      const consumerTitle = t('meta.title');
      if (consumerTitle) document.title = consumerTitle;
      if (metaDesc && prevDesc != null) metaDesc.setAttribute('content', prevDesc);
    };
  }, [t, i18n.language, titleKey, descKey]);
}
