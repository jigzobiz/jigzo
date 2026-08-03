import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function AboutPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  useEffect(() => {
    document.title = t('about.metaTitle');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('about.metaDesc'));
    }
  }, [t, i18n.language]);

  return (
    <div className="about-page" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      <SiteHeader switcherLocation="about_nav" />

      <main
        className="about-container"
        style={{
          maxWidth: 720,
          margin: '40px auto 80px',
          padding: '0 24px',
          fontFamily: 'Archia, sans-serif',
          lineHeight: 1.7,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontWeight: 300, fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '-0.02em', marginBottom: 24 }}>
          {t('about.title')}
        </h1>
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>
        <p>{t('about.p3')}</p>
        <p>{t('about.p4')}</p>
        <p>{t('about.p5')}</p>

        <Link className="btn btn-dark" to="/" style={{ marginTop: 24 }}>
          {t('about.home')}
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
