import React from 'react';
import { useTranslation } from 'react-i18next';
import BusinessRecipientJourney from './BusinessRecipientJourney';

const EXPERIENCE_IDS = ['reveal', 'invitation', 'challenge', 'reward'];

export default function BusinessHero({ experience, onExperienceChange, onEarlyAccess }) {
  const { t } = useTranslation();

  return (
    <section className="jzb-hero" id="business-top">
      <div className="jzb-hero__glow" aria-hidden="true" />
      <div className="jzb-shell jzb-hero__grid">
        <div className="jzb-hero__copy">
          <p className="jzb-eyebrow">{t('business.hero.eyebrow')}</p>
          <h1>
            <span>{t('business.hero.lineOne')}</span>
            <em>{t('business.hero.lineTwo')}</em>
          </h1>
          <p className="jzb-hero__lede">{t('business.hero.lede')}</p>
          <div className="jzb-hero__actions">
            <button className="jzb-button jzb-button--gold" type="button" onClick={onEarlyAccess}>{t('business.cta.earlyAccess')}</button>
            <a className="jzb-button jzb-button--ghost-dark" href="#business-experiences">{t('business.cta.seeHow')}</a>
          </div>
        </div>
        <div className="jzb-hero__product">
          <div className="jzb-hero__orbit" aria-hidden="true"><span /><span /><span /></div>
          <BusinessRecipientJourney experience={experience} />
          <div className="jzb-experience-tabs" role="tablist" aria-label={t('business.experiences.label')}>
            {EXPERIENCE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={experience === id}
                className={experience === id ? 'is-active' : ''}
                onClick={() => onExperienceChange(id, true)}
              >
                <span>{t(`business.experiences.${id}.name`)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
