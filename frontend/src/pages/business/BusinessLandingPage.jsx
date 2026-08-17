import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BusinessHeader from '../../business/landing/BusinessHeader';
import BusinessHero from '../../business/landing/BusinessHero';
import BusinessDemoModal from '../../business/landing/BusinessDemoModal';
import BusinessPuzzle from '../../business/landing/BusinessPuzzle';
import { analytics } from '../../services/analytics';
import { isStagingBusinessHost } from '../../business/auth/businessAccess';
import { Link } from 'react-router-dom';
import '../../business/landing/business-landing.css';

const EXPERIENCE_IDS = ['reveal', 'invitation', 'challenge', 'reward'];
const PERSON_IDS = ['sara', 'omar', 'noor'];
const ACTIVITY_IDS = ['sara', 'omar', 'noor'];

export default function BusinessLandingPage() {
  const { t, i18n } = useTranslation();
  const [experience, setExperience] = useState(EXPERIENCE_IDS[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const manualSelection = useRef(false);
  const accessHref = isStagingBusinessHost() ? '/business/login' : null;

  const changeExperience = useCallback((id, manual = false) => {
    if (manual) {
      manualSelection.current = true;
      analytics.track('business_experience_selected', { experience: id });
    }
    setExperience(id);
  }, []);

  useEffect(() => {
    analytics.track('business_landing_viewed');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;
    let index = 0;
    const timer = window.setInterval(() => {
      if (manualSelection.current || index >= EXPERIENCE_IDS.length - 1) {
        window.clearInterval(timer);
        return;
      }
      index += 1;
      changeExperience(EXPERIENCE_IDS[index]);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [changeExperience]);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content');
    document.title = t('business.meta.title');
    description?.setAttribute('content', t('business.meta.description'));
    return () => {
      document.title = previousTitle;
      if (previousDescription) description?.setAttribute('content', previousDescription);
    };
  }, [i18n.language, t]);

  const openEarlyAccess = () => {
    setModalOpen(true);
    analytics.track('business_early_access_opened');
  };

  return (
    <div className="jzb-page">
      <BusinessHeader onEarlyAccess={openEarlyAccess} accessHref={accessHref} />
      <main>
        <BusinessHero experience={experience} onExperienceChange={changeExperience} onEarlyAccess={openEarlyAccess} accessHref={accessHref} />

        <section className="jzb-experiences" id="business-experiences">
          <div className="jzb-shell jzb-experiences__inner">
            <div className="jzb-section-copy jzb-section-copy--center">
              <p className="jzb-eyebrow">{t('business.experiences.eyebrow')}</p>
              <h2>{t('business.experiences.title')}</h2>
              <p>{t('business.experiences.body')}</p>
            </div>
            <div className="jzb-experience-core" aria-hidden="true">
              <BusinessPuzzle className="jzb-experience-core__puzzle" finalPiece={experience === 'reveal' ? 4 : experience === 'invitation' ? 2 : experience === 'challenge' ? 6 : 8} />
              <span>{t(`business.experiences.${experience}.name`)}</span>
            </div>
            <div className="jzb-experience-rail">
              {EXPERIENCE_IDS.map((id, index) => (
                <button key={id} className={experience === id ? 'is-active' : ''} type="button" aria-pressed={experience === id} onClick={() => changeExperience(id, true)}>
                  <span className="jzb-ltr">0{index + 1}</span>
                  <strong>{t(`business.experiences.${id}.name`)}</strong>
                  <small>{t(`business.experiences.${id}.short`)}</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="jzb-studio">
          <div className="jzb-shell">
            <div className="jzb-section-copy jzb-studio__copy">
              <p className="jzb-eyebrow">{t('business.studio.eyebrow')}</p>
              <h2>{t('business.studio.title')}</h2>
              <p>{t('business.studio.body')}</p>
            </div>
            <div className="jzb-studio__canvas">
              <div className="jzb-studio__creative">
                <div className="jzb-studio__message">
                  <span>{t('business.studio.previewLabel')}</span>
                  <strong>{t('business.studio.previewTitle')}</strong>
                  <small>{t('business.studio.campaign')}</small>
                </div>
                <BusinessPuzzle className="jzb-studio__puzzle" finalPiece={7} />
              </div>
              <div className="jzb-studio__tools">
                {['experience', 'puzzle', 'audience', 'delivery'].map((id, index) => (
                  <div key={id}><span className="jzb-ltr">0{index + 1}</span><strong>{t(`business.studio.steps.${id}`)}</strong>{index === 2 && <small>{t('business.studio.personalized')}</small>}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="jzb-personal">
          <div className="jzb-shell">
            <div className="jzb-section-copy jzb-section-copy--center">
              <p className="jzb-eyebrow">{t('business.personal.eyebrow')}</p>
              <h2>{t('business.personal.title')}</h2>
            </div>
            <div className="jzb-personal__deck">
              {PERSON_IDS.map((id, index) => (
                <article className={`jzb-person-card jzb-person-card--${index + 1}`} key={id}>
                  <span>{t('business.personal.for')}</span>
                  <h3>{t(`business.personal.people.${id}.name`)}</h3>
                  <p>{t(`business.personal.people.${id}.message`)}</p>
                  <small>{t(`business.personal.people.${id}.result`)}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="jzb-activity">
          <div className="jzb-shell">
              <div className="jzb-section-copy jzb-activity__copy">
                <p className="jzb-eyebrow">{t('business.activity.eyebrow')}</p>
                <h2>{t('business.activity.title')}</h2>
                <p>{t('business.activity.demoLabel')}</p>
              </div>
              <div className="jzb-activity__trail">
                <div className="jzb-activity__path" aria-hidden="true" />
                {ACTIVITY_IDS.map((id, index) => (
                  <article key={id} className={`jzb-activity__event jzb-activity__event--${index + 1}`}>
                    <span className="jzb-activity__piece" aria-hidden="true" />
                    <i className="jzb-ltr">0{index + 1}</i>
                    <p><strong>{t(`business.activity.items.${id}.name`)}</strong> {t(`business.activity.items.${id}.action`)}</p>
                    <time className="jzb-ltr">{t(`business.activity.items.${id}.meta`)}</time>
                  </article>
                ))}
                <div className="jzb-activity__complete"><strong className="jzb-ltr">3 / 3</strong><span>{t('business.activity.complete')}</span></div>
              </div>
          </div>
        </section>

        <section className="jzb-closing">
          <div className="jzb-closing__piece" aria-hidden="true">J</div>
          <div className="jzb-shell jzb-closing__inner">
            <p className="jzb-eyebrow">{t('business.closing.eyebrow')}</p>
            <h2>{t('business.closing.title')}</h2>
            {accessHref ? <Link className="jzb-button jzb-button--gold" to={accessHref}>{t('business.cta.signIn')}</Link> : <button className="jzb-button jzb-button--gold" type="button" onClick={openEarlyAccess}>{t('business.cta.earlyAccess')}</button>}
          </div>
        </section>
      </main>
      <footer className="jzb-footer"><div className="jzb-shell"><img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" /><span>{t('business.footer')}</span></div></footer>
      {!accessHref && <BusinessDemoModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
