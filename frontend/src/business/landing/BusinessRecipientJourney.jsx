import React from 'react';
import { useTranslation } from 'react-i18next';
import BusinessPhoneFrame from './BusinessPhoneFrame';
import BusinessPuzzle from './BusinessPuzzle';

function ExperienceOutcome({ experience }) {
  const { t } = useTranslation();

  return (
    <div className={`jzb-outcome jzb-outcome--${experience}`}>
      <div className="jzb-outcome__mark" aria-hidden="true">
        {experience === 'reveal' && '✦'}
        {experience === 'invitation' && '12'}
        {experience === 'challenge' && '#4'}
        {experience === 'reward' && '10%'}
      </div>
      <p className="jzb-outcome__kicker">{t(`business.experiences.${experience}.kicker`)}</p>
      <h3>{t(`business.experiences.${experience}.result`)}</h3>
      <p>{t(`business.experiences.${experience}.detail`)}</p>
      {experience === 'invitation' && (
        <div className="jzb-outcome__choice"><span>{t('business.experiences.invitation.going')}</span><span>{t('business.experiences.invitation.plusOne')}</span></div>
      )}
      {experience === 'reward' && <div className="jzb-outcome__code">JIGZO10</div>}
    </div>
  );
}

export default function BusinessRecipientJourney({ experience }) {
  const { t } = useTranslation();

  return (
    <BusinessPhoneFrame label={t('business.hero.phoneLabel')}>
      <div className="jzb-recipient">
        <div className="jzb-recipient__topline">
          <span>{t('business.hero.company')}</span>
          <span className="jzb-ltr">09:41</span>
        </div>
        <BusinessPuzzle className="jzb-recipient__puzzle" />
        <div className="jzb-recipient__solve">
          <span>{t('business.hero.solved')}</span>
          <span className="jzb-ltr">00:21</span>
        </div>
        <ExperienceOutcome experience={experience} />
      </div>
    </BusinessPhoneFrame>
  );
}
