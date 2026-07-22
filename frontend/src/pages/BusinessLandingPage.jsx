import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BizNav from '../business/BizNav';
import BizHero from '../business/BizHero';
import RecipientJourney from '../business/RecipientJourney';
import DemoModal from '../business/DemoModal';
import { useBizMeta } from '../business/useBizMeta';
import { analytics } from '../services/analytics';
import '../business/business.css';

const CHECK = (
  <svg className="biz-pack__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function BusinessLandingPage() {
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);
  useBizMeta('business.meta.title', 'business.meta.description');

  useEffect(() => { analytics.track('business_landing_viewed'); }, []);

  const openDemo = () => { setDemoOpen(true); analytics.track('business_demo_modal_opened'); };

  const process = t('business.process.steps', { returnObjects: true });
  const empTags = t('business.employees.tags', { returnObjects: true });
  const cusTags = t('business.customers.tags', { returnObjects: true });
  const builderSteps = t('business.builderPreview.steps', { returnObjects: true });
  const funnel = t('business.analyticsPreview.funnel', { returnObjects: true });
  const formats = t('business.examples.formats', { returnObjects: true });
  const trustItems = t('business.trust.items', { returnObjects: true });
  const packs = t('business.packs.list', { returnObjects: true });

  const funnelBase = Array.isArray(funnel) && funnel.length ? parseInt(funnel[0].value, 10) : 1;

  // builder-preview stepper display states (done / active / todo)
  const previewState = ['done', 'done', 'active', 'todo', 'todo', 'todo'];

  return (
    <div className="biz">
      <BizNav onBookDemo={openDemo} />

      <main>
        {/* 1 — HERO */}
        <BizHero onBookDemo={openDemo} onWatch={() => scrollToId('biz-recipient')} />

        {/* 2 — COMMUNICATION PROBLEM */}
        <section className="biz-section">
          <div className="biz-wrap">
            <div className="biz-problem">
              <h2>{t('business.problem.title')}</h2>
              <p>{t('business.problem.body')}</p>
            </div>
          </div>
        </section>

        {/* 3 + 4 — ENGAGE EMPLOYEES / SURPRISE CUSTOMERS */}
        <section className="biz-split" id="biz-employees" aria-label={t('business.employees.title')}>
          <div className="biz-split__panel biz-split__panel--light">
            <div className="biz-split__inner">
              <h2 className="biz-split__title">{t('business.employees.title')}</h2>
              <p className="biz-split__lede">{t('business.employees.lede')}</p>
              <div className="biz-split__visual" style={{ background: 'var(--ink-900)', display: 'grid', placeItems: 'center' }} aria-hidden="true">
                <div className="biz-scr__puzzle" style={{ width: '46%' }}>
                  {[1, 1, 0, 1, 0, 0].map((f, i) => (
                    <span key={i} className={`biz-scr__pc ${f ? 'biz-scr__pc--filled' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="biz-tags">
                {(Array.isArray(empTags) ? empTags : []).map((tag) => <span key={tag} className="biz-tag">{tag}</span>)}
              </div>
            </div>
          </div>
          <div className="biz-split__panel biz-split__panel--dark" id="biz-customers">
            <div className="biz-split__inner">
              <h2 className="biz-split__title">{t('business.customers.title')}</h2>
              <p className="biz-split__lede">{t('business.customers.lede')}</p>
              <div className="biz-split__visual" style={{ background: 'var(--gradient-reveal)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '20px' }} aria-hidden="true">
                <div>
                  <img src="/assets/JIGZO-Icon-Gradient1.png" alt="" style={{ height: 34, margin: '0 auto 10px' }} />
                  <div className="biz-scr__reveal-title">{t('business.hero.cusReveal')}</div>
                </div>
              </div>
              <div className="biz-tags">
                {(Array.isArray(cusTags) ? cusTags : []).map((tag) => <span key={tag} className="biz-tag">{tag}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* 5 — CREATE / PERSONALIZE / SEND / TRACK */}
        <section className="biz-section biz-section--sunken" id="biz-how">
          <div className="biz-wrap">
            <div className="biz-section__head">
              <p className="biz-eyebrow">{t('business.process.eyebrow')}</p>
              <h2 className="biz-h2">{t('business.process.title')}</h2>
            </div>
            <div className="biz-steps">
              {(Array.isArray(process) ? process : []).map((s) => (
                <div className="biz-step" key={s.n}>
                  <div className="biz-step__num biz-ltr">{s.n}</div>
                  <div className="biz-step__title">{s.title}</div>
                  <div className="biz-step__body">{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6 — RECIPIENT EXPERIENCE DEMONSTRATION */}
        <section className="biz-section biz-section--dark" id="biz-recipient">
          <div className="biz-wrap">
            <div className="biz-section__head">
              <p className="biz-eyebrow biz-eyebrow--on-dark">{t('business.journey.eyebrow')}</p>
              <h2 className="biz-h2">{t('business.recipientDemo.title')}</h2>
              <p className="biz-lede">{t('business.recipientDemo.body')}</p>
            </div>
            <RecipientJourney />
          </div>
        </section>

        {/* 7 — CAMPAIGN-BUILDER PREVIEW */}
        <section className="biz-section">
          <div className="biz-wrap">
            <div className="biz-section__head">
              <h2 className="biz-h2">{t('business.builderPreview.title')}</h2>
              <p className="biz-lede">{t('business.builderPreview.body')}</p>
            </div>
            <div className="biz-builderpreview">
              {(Array.isArray(builderSteps) ? builderSteps : []).map((label, i) => (
                <div key={label} className={`biz-builderpreview__step biz-builderpreview__step--${previewState[i]}`}>{label}</div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link className="biz-btn biz-btn--secondary" to="/business/campaigns/new">
                {t('business.builderPreview.title')} →
              </Link>
            </div>
          </div>
        </section>

        {/* 8 — CAMPAIGN ANALYTICS PREVIEW */}
        <section className="biz-section biz-section--sunken">
          <div className="biz-wrap">
            <div className="biz-analytics-preview">
              <div className="biz-analytics-preview__copy">
                <h2>{t('business.analyticsPreview.title')}</h2>
                <p>{t('business.analyticsPreview.body')}</p>
              </div>
              <div className="biz-analytics-card">
                <div className="biz-panel__title">{t('business.dashboard.funnelTitle')}</div>
                <div className="biz-funnel">
                  {(Array.isArray(funnel) ? funnel : []).map((f) => {
                    const pct = Math.round((parseInt(f.value, 10) / funnelBase) * 100);
                    return (
                      <div className="biz-funnel__row" key={f.label}>
                        <span className="biz-funnel__label">{f.label}</span>
                        <span className="biz-funnel__track"><span className="biz-funnel__fill" style={{ width: `${pct}%` }} /></span>
                        <span className="biz-funnel__value biz-ltr">{f.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9 — CAMPAIGN EXAMPLES */}
        <section className="biz-section" id="biz-examples">
          <div className="biz-wrap">
            <div className="biz-section__head">
              <h2 className="biz-h2">{t('business.examples.title')}</h2>
            </div>
            <div className="biz-cards">
              {(Array.isArray(formats) ? formats : []).map((f) => (
                <div className="biz-card" key={f.name}>
                  <div className="biz-card__glyph" aria-hidden="true">
                    <img src="/assets/JIGZO-Icon-Gradient1.png" alt="" style={{ height: 24 }} />
                  </div>
                  <div className="biz-card__title">{f.name}</div>
                  <div className="biz-card__body">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 10 — CORPORATE TRUST */}
        <section className="biz-section biz-section--dark">
          <div className="biz-wrap">
            <div className="biz-section__head">
              <h2 className="biz-h2">{t('business.trust.title')}</h2>
              <p className="biz-lede">{t('business.trust.subtitle')}</p>
            </div>
            <ul className="biz-trust" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {(Array.isArray(trustItems) ? trustItems : []).map((item) => (
                <li className="biz-trust__item" key={item}>
                  <span className="biz-trust__dot" aria-hidden="true" />
                  <span className="biz-trust__text">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 11 — CORPORATE PACKS */}
        <section className="biz-section" id="biz-packs">
          <div className="biz-wrap">
            <div className="biz-section__head">
              <h2 className="biz-h2">{t('business.packs.title')}</h2>
              <p className="biz-lede">{t('business.packs.subtitle')}</p>
            </div>
            <div className="biz-packs">
              {(Array.isArray(packs) ? packs : []).map((pack) => {
                const isEnterprise = pack.id === 'enterprise';
                return (
                  <div className={`biz-pack ${pack.recommended ? 'biz-pack--recommended' : ''}`} key={pack.id}>
                    {pack.recommended && <span className="biz-pack__flag">{t('business.packs.recommended')}</span>}
                    <div className="biz-pack__name">{pack.name}</div>
                    <div className="biz-pack__size">{pack.size}</div>
                    <div className="biz-pack__feats">
                      {pack.features.map((feat) => (
                        <div className="biz-pack__feat" key={feat}>{CHECK}<span>{feat}</span></div>
                      ))}
                    </div>
                    <button type="button" className="biz-btn biz-btn--secondary biz-btn--block" onClick={openDemo}>
                      {isEnterprise ? t('business.packs.contactSales') : t('business.packs.requestPricing')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 12 — BOOK A DEMO CTA */}
        <section className="biz-section biz-section--sunken">
          <div className="biz-wrap">
            <div className="biz-finalcta">
              <h2>{t('business.finalCta.title')}</h2>
              <p>{t('business.finalCta.body')}</p>
              <div className="biz-finalcta__cta">
                <button type="button" className="biz-btn biz-btn--primary" onClick={openDemo}>
                  {t('business.finalCta.bookDemo')}
                </button>
                <button type="button" className="biz-btn biz-btn--secondary" onClick={openDemo}>
                  {t('business.finalCta.contactSales')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 13 — FOOTER */}
      <footer className="biz-footer">
        <div className="biz-footer__inner">
          <div className="biz-footer__brand">
            <img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
            <span className="biz-footer__copy">{t('business.footer.copy')}</span>
          </div>
          <div className="biz-footer__links">
            <Link className="biz-footer__link" to="/terms">{t('business.footer.privacy')}</Link>
            <Link className="biz-footer__link" to="/terms">{t('business.footer.terms')}</Link>
            <button type="button" onClick={openDemo}>{t('business.footer.contactSales')}</button>
          </div>
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
