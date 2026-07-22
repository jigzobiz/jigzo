import React from 'react';
import { useTranslation } from 'react-i18next';
import BizPhone from './BizPhone';

// Six-stage recipient-experience demonstration. Portrait phones, fully RTL-aware
// (Arabic copy flows right-to-left; the WhatsApp timestamp stays LTR). Rendered
// as the landing "Recipient experience" section and as the standalone journey.
export default function RecipientJourney() {
  const { t } = useTranslation();
  const stages = t('business.journey.stages', { returnObjects: true });

  const scenes = [
    // 1 — WhatsApp notification
    (
      <div className="biz-wa">
        <div className="biz-wa__head">
          <span className="biz-wa__av" aria-hidden="true" />
          <span className="biz-wa__name">{t('business.journey.waName')}</span>
        </div>
        <div className="biz-wa__body">
          <div className="biz-wa__bubble">
            {t('business.journey.notification')}
            <div className="biz-wa__meta biz-ltr">{t('business.journey.waTime')}</div>
          </div>
        </div>
      </div>
    ),
    // 2 — Personal introduction
    (
      <div className="biz-scr biz-scr--dark biz-scr--pad">
        <span className="biz-scr__org">{t('business.journey.org')}</span>
        <img className="biz-scr__ico" src="/assets/JIGZO-Icon-Beige.png" alt="" />
        <div className="biz-scr__intro">{t('business.journey.intro')}</div>
        <div className="biz-scr__campaign">{t('business.journey.campaignName')}</div>
      </div>
    ),
    // 3 — The puzzle
    (
      <div className="biz-scr biz-scr--dark biz-scr--pad">
        <div className="biz-scr__puzzle">
          {[1, 1, 0, 1, 0, 0, 0, 0, 0].map((f, i) => (
            <span key={i} className={`biz-scr__pc ${f ? 'biz-scr__pc--filled' : ''}`} />
          ))}
        </div>
        <span className="biz-scr__hint">{t('business.journey.puzzleHint')}</span>
      </div>
    ),
    // 4 — Final piece locks in
    (
      <div className="biz-scr biz-scr--dark biz-scr--pad">
        <div className="biz-scr__puzzle">
          {[1, 1, 1, 1, 1, 1, 1, 1, 0].map((f, i) => (
            <span key={i} className={`biz-scr__pc ${f ? 'biz-scr__pc--filled' : ''}`} />
          ))}
        </div>
        <span className="biz-scr__lockpiece" aria-hidden="true" />
        <span className="biz-scr__hint">{t('business.journey.locked')}</span>
      </div>
    ),
    // 5 — Reveal
    (
      <div className="biz-scr biz-scr--reveal biz-scr--pad">
        <img className="biz-scr__ico" src="/assets/JIGZO-Icon-Gradient1.png" alt="" />
        <div className="biz-scr__reveal-title">{t('business.journey.revealTitle')}</div>
        <div className="biz-scr__reveal-msg">{t('business.journey.revealMessage')}</div>
      </div>
    ),
    // 6 — Call to action
    (
      <div className="biz-scr biz-scr--reveal biz-scr--pad">
        <div className="biz-scr__reveal-title">{t('business.journey.revealTitle')}</div>
        <div className="biz-scr__reveal-msg">{t('business.journey.ctaLine')}</div>
        <span className="biz-scr__cta">{t('business.journey.cta')}</span>
      </div>
    ),
  ];

  return (
    <div className="biz-journey">
      {scenes.map((scene, i) => (
        <div className="biz-journey__stage" key={i}>
          <BizPhone className="biz-journey__phone" label={Array.isArray(stages) ? stages[i] : undefined}>
            {scene}
          </BizPhone>
          <div className="biz-journey__cap">
            <div className="biz-journey__cap-n biz-ltr">{i + 1}</div>
            <div className="biz-journey__cap-t">{Array.isArray(stages) ? stages[i] : ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
