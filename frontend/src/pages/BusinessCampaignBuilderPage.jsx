import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BizPhone from '../business/BizPhone';
import { useBizMeta } from '../business/useBizMeta';
import { analytics } from '../services/analytics';
import '../business/business.css';

// Static, local-state-only campaign builder prototype. Nothing is persisted;
// "Launch" is intentionally disabled with a clear prototype-only message.
const STEP_COUNT = 8;

// Render a personalization token with the {{ }} kept literal but visually chipped.
function tokenize(text) {
  const parts = String(text).split(/(\{\{\s*[\w]+\s*\}\})/g);
  return parts.map((p, i) =>
    /^\{\{\s*[\w]+\s*\}\}$/.test(p)
      ? <span key={i} className="biz-tokenchip">{p}</span>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

export default function BusinessCampaignBuilderPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState('recognition');
  const [type, setType] = useState('reveal');
  const [difficulty, setDifficulty] = useState(1);
  const [audience, setAudience] = useState('employees');
  const [channels, setChannels] = useState({ whatsapp: true });
  useBizMeta('business.metaBuilder.title');

  useEffect(() => { analytics.track('business_builder_viewed'); }, []);

  const steps = t('business.builder.steps', { returnObjects: true });
  const objOptions = t('business.builder.objective.options', { returnObjects: true });
  const typeOptions = t('business.builder.type.options', { returnObjects: true });
  const audOptions = t('business.builder.audience.options', { returnObjects: true });
  const deliveryChannels = t('business.builder.delivery.channels', { returnObjects: true });
  const difficulties = t('business.builder.puzzle.difficulties', { returnObjects: true });
  const tokens = t('business.builder.personalize.tokens', { returnObjects: true });

  const titleOf = (list, id) => (Array.isArray(list) ? list.find((o) => o.id === id) : null)?.title || '';
  const selectedChannelTitles = (Array.isArray(deliveryChannels) ? deliveryChannels : [])
    .filter((c) => channels[c.id]).map((c) => c.title);

  const isLast = step === STEP_COUNT - 1;
  const go = (i) => setStep(Math.max(0, Math.min(STEP_COUNT - 1, i)));

  const toggleChannel = (id) => setChannels((prev) => ({ ...prev, [id]: !prev[id] }));

  const OptionGrid = ({ list, value, onSelect }) => (
    <div className="biz-optgrid">
      {(Array.isArray(list) ? list : []).map((o) => (
        <button
          key={o.id}
          type="button"
          className={`biz-opt ${value === o.id ? 'biz-opt--selected' : ''}`}
          aria-pressed={value === o.id}
          onClick={() => onSelect(o.id)}
        >
          <div className="biz-opt__title">{o.title}</div>
          <div className="biz-opt__desc">{o.desc}</div>
        </button>
      ))}
    </div>
  );

  const Field = ({ label, children }) => (
    <div>
      <div className="biz-field" style={{ gap: 8 }}>
        <label>{label}</label>
        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-raised)', fontSize: 15, color: 'var(--text-strong)', lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.objective.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.objective.desc')}</p>
            <OptionGrid list={objOptions} value={objective} onSelect={setObjective} />
          </>
        );
      case 1:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.type.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.type.desc')}</p>
            <OptionGrid list={typeOptions} value={type} onSelect={setType} />
          </>
        );
      case 2:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.puzzle.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.puzzle.desc')}</p>
            <div>
              <div className="biz-field"><label>{t('business.builder.puzzle.imageLabel')}</label></div>
              <div className="biz-upload">
                <span className="biz-upload__thumb" aria-hidden="true" />
                <div>
                  <div className="biz-upload__name biz-ltr">{t('business.builder.puzzle.imageName')}</div>
                  <div className="biz-upload__meta biz-ltr">{t('business.builder.puzzle.imageMeta')}</div>
                </div>
              </div>
            </div>
            <div className="biz-field"><label>{t('business.builder.puzzle.difficultyLabel')}</label>
              <div className="biz-optgrid">
                {(Array.isArray(difficulties) ? difficulties : []).map((d, i) => (
                  <button key={d} type="button" className={`biz-opt ${difficulty === i ? 'biz-opt--selected' : ''}`} aria-pressed={difficulty === i} onClick={() => setDifficulty(i)}>
                    <div className="biz-opt__title">{d}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.reveal.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.reveal.desc')}</p>
            <Field label={t('business.builder.reveal.headlineLabel')}>{tokenize(t('business.builder.reveal.headlineValue'))}</Field>
            <Field label={t('business.builder.reveal.messageLabel')}>{t('business.builder.reveal.messageValue')}</Field>
            <Field label={t('business.builder.reveal.typeLabel')}>{t('business.builder.reveal.typeValue')}</Field>
            <p className="biz-builder__stepdesc" style={{ marginTop: 0 }}>{tokenize(t('business.builder.reveal.tokenHint'))}</p>
          </>
        );
      case 4:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.audience.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.audience.desc')}</p>
            <OptionGrid list={audOptions} value={audience} onSelect={setAudience} />
          </>
        );
      case 5:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.personalize.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.personalize.desc')}</p>
            <div className="biz-upload">
              <span className="biz-upload__thumb" aria-hidden="true" />
              <div>
                <div className="biz-upload__name biz-ltr">{t('business.builder.personalize.uploadName')}</div>
                <div className="biz-upload__meta biz-ltr">{t('business.builder.personalize.uploadMeta')}</div>
              </div>
            </div>
            <div className="biz-field"><label>{t('business.builder.personalize.tokenLabel')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Array.isArray(tokens) ? tokens : []).map((tok) => <span key={tok} className="biz-tokenchip biz-ltr">{tok}</span>)}
              </div>
            </div>
          </>
        );
      case 6:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.delivery.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.delivery.desc')}</p>
            <div className="biz-optgrid">
              {(Array.isArray(deliveryChannels) ? deliveryChannels : []).map((c) => (
                <button key={c.id} type="button" className={`biz-opt ${channels[c.id] ? 'biz-opt--selected' : ''}`} aria-pressed={!!channels[c.id]} onClick={() => toggleChannel(c.id)}>
                  <div className="biz-opt__title">{c.title}</div>
                  <div className="biz-opt__desc">{c.desc}</div>
                </button>
              ))}
            </div>
          </>
        );
      case 7:
        return (
          <>
            <h2 className="biz-builder__steptitle">{t('business.builder.schedule.title')}</h2>
            <p className="biz-builder__stepdesc">{t('business.builder.schedule.desc')}</p>
            <Field label={t('business.builder.schedule.startLabel')}><span className="biz-ltr">{t('business.builder.schedule.startValue')}</span></Field>
            <Field label={t('business.builder.schedule.expiryLabel')}><span className="biz-ltr">{t('business.builder.schedule.expiryValue')}</span></Field>
            <Field label={t('business.builder.schedule.timezoneLabel')}>{t('business.builder.schedule.timezoneValue')}</Field>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="biz">
      <div className="biz-builder">
        {/* Top bar */}
        <div className="biz-builder__bar">
          <div className="biz-builder__bar-l">
            <Link to="/business/dashboard" aria-label={t('business.nav.home')}>
              <img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
            </Link>
            <span className="biz-builder__bar-title">{t('business.builder.title')}</span>
          </div>
          <span className="biz-builder__bar-step biz-ltr">{t('business.builder.stepLabel', { current: step + 1, total: STEP_COUNT })}</span>
        </div>

        <div className="biz-protobar">
          <strong>{t('business.nav.badge')}</strong> · {t('business.proto.builder')}
        </div>

        {/* Stepper */}
        <div className="biz-builder__stepper" role="tablist" aria-label={t('business.builder.title')}>
          {(Array.isArray(steps) ? steps : []).map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="biz-stepsep" aria-hidden="true" />}
              <button
                type="button"
                role="tab"
                aria-selected={i === step}
                className={`biz-stepchip ${i === step ? 'biz-stepchip--active' : i < step ? 'biz-stepchip--done' : ''}`}
                onClick={() => go(i)}
              >
                <span className="biz-ltr">{i + 1}.</span> {label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Body: form + live preview */}
        <div className="biz-builder__body">
          <div className="biz-builder__form">
            {renderStep()}

            <div className="biz-builder__nav">
              <button type="button" className="biz-btn biz-btn--secondary" onClick={() => go(step - 1)} disabled={step === 0}>
                {t('business.builder.back')}
              </button>
              <button type="button" className="biz-btn biz-btn--secondary">
                {t('business.builder.previewTest')}
              </button>
              {isLast ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="biz-btn biz-btn--primary" disabled aria-disabled="true">
                    {t('business.builder.launch')}
                  </button>
                  <span className="biz-builder__launch-note">{t('business.builder.launchNote')}</span>
                </div>
              ) : (
                <button type="button" className="biz-btn biz-btn--primary" onClick={() => go(step + 1)}>
                  {t('business.builder.next')}
                </button>
              )}
            </div>
          </div>

          {/* Live mobile preview */}
          <div className="biz-builder__preview">
            <div style={{ width: '100%', maxWidth: 300 }}>
              <div className="biz-preview-chips">
                <span className="biz-preview-chip">{titleOf(objOptions, objective)}</span>
                <span className="biz-preview-chip">{titleOf(typeOptions, type)}</span>
                <span className="biz-preview-chip">{titleOf(audOptions, audience)}</span>
                {selectedChannelTitles.slice(0, 1).map((c) => <span key={c} className="biz-preview-chip biz-ltr">{c}</span>)}
              </div>
              <p className="biz-eyebrow" style={{ textAlign: 'center', marginBottom: 12 }}>{t('business.builder.previewLabel')}</p>
              <BizPhone className="biz-builder__preview-phone" label={t('business.builder.revealPreview.title')}>
                <div className="biz-scr biz-scr--reveal biz-scr--pad">
                  <img className="biz-scr__ico" src="/assets/JIGZO-Icon-Gradient1.png" alt="" />
                  <div className="biz-scr__reveal-title">{t('business.builder.revealPreview.title')}</div>
                  <div className="biz-scr__reveal-msg">{t('business.builder.revealPreview.message')}</div>
                </div>
              </BizPhone>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
