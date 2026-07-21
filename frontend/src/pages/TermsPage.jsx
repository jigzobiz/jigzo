import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function TermsPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  useEffect(() => {
    document.title = isRtl ? "JIGZO | الشروط والأحكام وسياسة الخصوصية" : "JIGZO | Terms & Conditions & Privacy Policy";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', isRtl ? "شروط الخدمة وسياسة الخصوصية لمنصة JIGZO." : "Terms of Service and Privacy Policy for JIGZO.");
    }
  }, [isRtl]);

  const termsBullets2 = t('terms.sec2.bullets', { returnObjects: true }) || [];
  const termsBullets3 = t('terms.sec3.bullets', { returnObjects: true }) || [];
  const termsBullets4 = t('terms.sec4.bullets', { returnObjects: true }) || [];
  const termsBullets5 = t('terms.sec5.bullets', { returnObjects: true }) || [];
  const termsBullets7 = t('terms.sec7.bullets', { returnObjects: true }) || [];
  const termsBullets10 = t('terms.sec10.bullets', { returnObjects: true }) || [];
  const termsBullets12 = t('terms.sec12.bullets', { returnObjects: true }) || [];
  const termsBullets13 = t('terms.sec13.bullets', { returnObjects: true }) || [];

  const privSenderBullets = t('privacy.collect.senderBullets', { returnObjects: true }) || [];
  const privRecipBullets = t('privacy.collect.recipientBullets', { returnObjects: true }) || [];
  const privContentBullets = t('privacy.collect.contentBullets', { returnObjects: true }) || [];
  const privTechBullets = t('privacy.collect.technicalBullets', { returnObjects: true }) || [];
  const privWhyBullets = t('privacy.why.bullets', { returnObjects: true }) || [];
  const privRecordsBullets = t('privacy.records.bullets', { returnObjects: true }) || [];
  const privSharingBullets = t('privacy.sharing.bullets', { returnObjects: true }) || [];
  const privCookiesBullets = t('privacy.cookies.bullets', { returnObjects: true }) || [];
  const privRightsBullets = t('privacy.rights.bullets', { returnObjects: true }) || [];

  return (
    <div className="terms-page" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
      {/* ===================== NAV ===================== */}
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" aria-label={t('landing.nav.home')}>
            <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <div className="nav__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LanguageSwitcher location="terms_nav" />
            <Link className="btn btn-ghost" to="/create">{t('landing.nav.createFull')}</Link>
          </div>
        </div>
      </header>

      <main className="terms-container" style={{ maxWidth: 800, margin: "40px auto 80px", padding: "0 24px", fontFamily: "Archia, sans-serif", lineHeight: 1.7 }}>
        <h1 style={{ fontWeight: 300, fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.02em", marginBottom: 8 }}>{t('terms.title')}</h1>
        <div className="terms-meta" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#A67C3D", marginBottom: 30 }}>{t('terms.lastUpdated')}</div>

        <h2>{t('terms.intro.welcome')}</h2>
        <p>{t('terms.intro.thanks')}</p>
        <p>{t('terms.intro.desc')}</p>
        <p>{t('terms.intro.agree')}</p>

        <h2>{t('terms.sec1.title')}</h2>
        <p>{t('terms.sec1.p1')}</p>
        <p>{t('terms.sec1.p2')}</p>

        <h2>{t('terms.sec2.title')}</h2>
        <p>{t('terms.sec2.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets2.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec2.p2')}</p>

        <h2>{t('terms.sec3.title')}</h2>
        <p>{t('terms.sec3.p1')}</p>
        <p>{t('terms.sec3.p2')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets3.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec3.p3')}</p>

        <h2>{t('terms.sec4.title')}</h2>
        <p>{t('terms.sec4.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets4.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec4.p2')}</p>

        <h2>{t('terms.sec5.title')}</h2>
        <p>{t('terms.sec5.p1')}</p>
        <p>{t('terms.sec5.p2')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets5.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec5.p3')}</p>
        <p>{t('terms.sec5.p4')}</p>
        <p>{t('terms.sec5.p5')}</p>

        <h2>{t('terms.sec6.title')}</h2>
        <p>{t('terms.sec6.p1')}</p>
        <p>{t('terms.sec6.p2')}</p>
        <p>{t('terms.sec6.p3')}</p>
        <p>{t('terms.sec6.p4')}</p>

        <h2>{t('terms.sec7.title')}</h2>
        <p>{t('terms.sec7.p1')}</p>
        <p>{t('terms.sec7.p2')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets7.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec7.p3')}</p>

        <h2>{t('terms.sec8.title')}</h2>
        <p>{t('terms.sec8.p1')}</p>
        <p>{t('terms.sec8.p2')}</p>

        <h2>{t('terms.sec9.title')}</h2>
        <p>{t('terms.sec9.p1')}</p>
        <p>{t('terms.sec9.p2')}</p>
        <p>{t('terms.sec9.p3')}</p>

        <h2>{t('terms.sec10.title')}</h2>
        <p>{t('terms.sec10.p1')}</p>
        <p>{t('terms.sec10.p2')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets10.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec10.p3')}</p>

        <h2>{t('terms.sec11.title')}</h2>
        <p>{t('terms.sec11.p1')}</p>
        <p>{t('terms.sec11.p2')}</p>

        <h2>{t('terms.sec12.title')}</h2>
        <p>{t('terms.sec12.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets12.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('terms.sec12.p2')}</p>

        <h2>{t('terms.sec13.title')}</h2>
        <p>{t('terms.sec13.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {termsBullets13.map((b, i) => <li key={i}>{b}</li>)}
        </ul>

        <h2>{t('terms.sec14.title')}</h2>
        <p>{t('terms.sec14.p1')}</p>

        <h2>{t('terms.sec15.title')}</h2>
        <p>{t('terms.sec15.p1')}</p>
        <p>{t('terms.sec15.p2')}</p>

        <h2>{t('terms.sec16.title')}</h2>
        <p>{t('terms.sec16.p1')}<a href="mailto:info@jigzo.biz">info@jigzo.biz</a></p>

        <hr style={{ border: "none", borderTop: "1px solid rgba(28,25,19,0.15)", margin: "60px 0 40px" }} />

        {/* ===================== PRIVACY ===================== */}
        <h1 style={{ fontWeight: 300, fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.02em", marginBottom: 8 }}>{t('privacy.title')}</h1>
        <div className="terms-meta" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#A67C3D", marginBottom: 30 }}>{t('terms.lastUpdated')}</div>

        <h2>{t('privacy.intro.welcome')}</h2>
        <p>{t('privacy.intro.p1')}</p>
        <p>{t('privacy.intro.p2')}</p>
        <p>{t('privacy.intro.p3')}</p>

        <h2>{t('privacy.collect.title')}</h2>
        <p>{t('privacy.collect.p1')}</p>
        <p><strong>{t('privacy.collect.sender')}</strong></p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privSenderBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p><strong>{t('privacy.collect.recipient')}</strong></p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privRecipBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p><strong>{t('privacy.collect.content')}</strong></p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privContentBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p><strong>{t('privacy.collect.technical')}</strong></p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privTechBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p><strong>{t('privacy.collect.payment')}</strong></p>
        <p>{t('privacy.collect.paymentDesc')}</p>

        <h2>{t('privacy.why.title')}</h2>
        <p>{t('privacy.why.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privWhyBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>

        <h2>{t('privacy.storage.title')}</h2>
        <p>{t('privacy.storage.p1')}</p>

        <h2>{t('privacy.records.title')}</h2>
        <p>{t('privacy.records.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privRecordsBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('privacy.records.p2')}</p>

        <h2>{t('privacy.sharing.title')}</h2>
        <p>{t('privacy.sharing.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privSharingBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('privacy.sharing.p2')}</p>

        <h2>{t('privacy.recipientPrivacy.title')}</h2>
        <p>{t('privacy.recipientPrivacy.p1')}</p>

        <h2>{t('privacy.cookies.title')}</h2>
        <p>{t('privacy.cookies.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privCookiesBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>

        <h2>{t('privacy.security.title')}</h2>
        <p>{t('privacy.security.p1')}</p>

        <h2>{t('privacy.rights.title')}</h2>
        <p>{t('privacy.rights.p1')}</p>
        <ul style={{ paddingRight: isRtl ? 20 : 0, paddingLeft: isRtl ? 0 : 20 }}>
          {privRightsBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p>{t('privacy.rights.p2')}<a href="mailto:info@jigzo.biz">info@jigzo.biz</a></p>

        <h2>{t('privacy.children.title')}</h2>
        <p>{t('privacy.children.p1')}</p>

        <h2>{t('privacy.intl.title')}</h2>
        <p>{t('privacy.intl.p1')}</p>
        <p>{t('privacy.intl.p2')}</p>

        <h2>{t('privacy.updates.title')}</h2>
        <p>{t('privacy.updates.p1')}</p>

        <h2>{t('privacy.contact.title')}</h2>
        <p>{t('privacy.contact.p1')}<a href="mailto:info@jigzo.biz">info@jigzo.biz</a></p>
      </main>
    </div>
  );
}
