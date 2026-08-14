import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CampaignStudioProvider, useCampaignStudio } from '../../business/studio/CampaignStudioContext';
import { studioCopy } from '../../business/studio/studio-copy';
import BusinessPuzzle from '../../business/landing/BusinessPuzzle';
import { PIECE_OPTIONS } from '../../config/difficulties';
import '../../business/studio/business-studio.css';

const EXPERIENCE_KEYS = ['invitation', 'reveal', 'challenge', 'reward'];

function Toggle({ checked, onChange, label, description, copy }) {
  return <label className="jzs-toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i aria-hidden="true" /><b>{checked ? copy.on : copy.off}</b></label>;
}

function Field({ label, children, wide = false }) {
  return <label className={`jzs-field${wide ? ' jzs-field--wide' : ''}`}><span>{label}</span>{children}</label>;
}

function PhonePreview({ copy, isArabic }) {
  const { state } = useCampaignStudio();
  const recipient = state.recipients.entitiesById[state.studio.selectedRecipientId];
  const recipientName = recipient ? (isArabic ? recipient.nameAr : recipient.name) : copy.preview.select;
  const message = recipient?.[isArabic ? 'messageAr' : 'message'] || state.experience.message;
  const plusOne = recipient?.plusOne === 'allow' || (recipient?.plusOne === 'inherit' && state.experience.allowPlusOneDefault);
  return <aside className="jzs-preview" aria-label={copy.preview.label}>
    <div className="jzs-preview__heading"><span>{copy.preview.label}</span><small>{copy.preview.demo}</small></div>
    <div className="jzs-phone">
      <div className="jzs-phone__screen">
        <span className="jzs-phone__island" />
        <div className="jzs-phone__top"><span>JIGZO</span><span className="jzs-ltr">9:41</span></div>
        <div className="jzs-phone__puzzle"><BusinessPuzzle finalPiece={4} /></div>
        <div className="jzs-phone__solved"><span aria-hidden="true">✓</span>{copy.preview.solved}</div>
        <div className="jzs-invitation">
          <p>{copy.preview.invitation}</p>
          <h3>{state.experience.eventTitle}</h3>
          <div className="jzs-invitation__meta"><span>{copy.preview.eventMeta}</span><span>{state.experience.location}</span></div>
          <p className="jzs-invitation__message">{message}</p>
          {state.experience.rsvpEnabled && <div className="jzs-rsvp"><button type="button">{copy.preview.going}</button><button type="button">{copy.preview.notGoing}</button></div>}
          {plusOne && <label className="jzs-guest"><input type="checkbox" /> {copy.preview.guest}</label>}
        </div>
      </div>
    </div>
    <div className="jzs-preview__recipient"><span>{copy.preview.personal}</span><strong>{recipientName}</strong></div>
  </aside>;
}

function CampaignArea({ copy }) {
  const { state, dispatch } = useCampaignStudio();
  return <>
    <AreaIntro copy={copy} index={0} />
    <Field label={copy.campaign.name} wide><input value={state.campaign.name} onChange={(e) => dispatch({ type: 'SET_FIELD', section: 'campaign', field: 'name', value: e.target.value })} /></Field>
    <div className="jzs-label">{copy.campaign.experience}</div>
    <div className="jzs-experience-grid">{EXPERIENCE_KEYS.map((key, index) => <button key={key} type="button" disabled={index > 0} className={index === 0 ? 'is-active' : ''}><span className="jzs-piece-mark" aria-hidden="true" /><strong>{copy.campaign[key]}</strong><small>{index === 0 ? copy.campaign.active : copy.campaign.coming}</small></button>)}</div>
  </>;
}

function PuzzleArea({ copy }) {
  const { state, dispatch } = useCampaignStudio();
  const fileInput = useRef(null);
  const selectImage = (event) => { const file = event.target.files?.[0]; if (file) dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'imagePreviewUrl', value: URL.createObjectURL(file) }); };
  return <>
    <AreaIntro copy={copy} index={1} />
    <div className="jzs-puzzle-stage">
      <div className="jzs-puzzle-art" style={state.puzzle.imagePreviewUrl ? { backgroundImage: `url(${state.puzzle.imagePreviewUrl})` } : undefined}><BusinessPuzzle finalPiece={7} /></div>
      <div><span className="jzs-label">{copy.puzzle.image}</span><button type="button" className="jzs-action" onClick={() => fileInput.current?.click()}>{copy.puzzle.upload}</button><input ref={fileInput} hidden type="file" accept="image/*" onChange={selectImage} /><small className="jzs-help">{copy.puzzle.mocked}</small></div>
    </div>
    <div className="jzs-label">{copy.puzzle.difficulty}</div>
    <div className="jzs-difficulty">{PIECE_OPTIONS.map((option) => <button type="button" key={option.id} className={state.puzzle.difficultyId === option.id ? 'is-active' : ''} onClick={() => dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'difficultyId', value: option.id })}><strong>{option.count}</strong><span>{copy.puzzle.pieces}</span></button>)}</div>
    <Toggle copy={copy.common} label={copy.puzzle.mystery} description={copy.puzzle.mysteryBody} checked={state.puzzle.mysteryMode} onChange={(value) => dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'mysteryMode', value })} />
  </>;
}

function ExperienceArea({ copy }) {
  const { state, dispatch } = useCampaignStudio(); const set = (field) => (e) => dispatch({ type: 'SET_FIELD', section: 'experience', field, value: e.target.value });
  return <><AreaIntro copy={copy} index={2} /><div className="jzs-experience-composer">
    <section className="jzs-composer-card jzs-composer-card--invitation">
      <header><span>01</span><div><h2>{copy.experience.invitationGroup}</h2><p>{copy.experience.invitationHint}</p></div></header>
      <Field label={copy.experience.eventTitle}><input value={state.experience.eventTitle} onChange={set('eventTitle')} /></Field>
      <Field label={copy.experience.location}><input value={state.experience.location} onChange={set('location')} /></Field>
      <Field label={copy.experience.message}><textarea rows="6" value={state.experience.message} onChange={set('message')} /></Field>
    </section>
    <aside className="jzs-composer-support">
      <section className="jzs-composer-card jzs-composer-card--details">
        <header><span>02</span><div><h2>{copy.experience.detailsGroup}</h2><p>{copy.experience.detailsHint}</p></div></header>
        <Field label={copy.experience.date}><div className="jzs-native-control"><input className="jzs-ltr" type="datetime-local" value={state.experience.dateTime} onChange={set('dateTime')} /></div></Field>
        <Field label={copy.experience.timezone}><div className="jzs-native-control jzs-native-control--select"><select className="jzs-ltr" value={state.experience.timezone} onChange={set('timezone')}><option>Asia/Bahrain</option><option>Asia/Dubai</option><option>Asia/Riyadh</option></select><i aria-hidden="true" /></div></Field>
        <Field label={copy.experience.deadline}><div className="jzs-native-control"><input className="jzs-ltr" type="date" value={state.experience.rsvpDeadline} onChange={set('rsvpDeadline')} /></div></Field>
      </section>
      <section className="jzs-composer-card jzs-composer-card--policy">
        <header><span>03</span><div><h2>{copy.experience.policyGroup}</h2><p>{copy.experience.policyHint}</p></div></header>
        <Toggle copy={copy.common} label={copy.experience.rsvp} checked={state.experience.rsvpEnabled} onChange={(value) => dispatch({ type: 'SET_FIELD', section: 'experience', field: 'rsvpEnabled', value })} />
        <Toggle copy={copy.common} label={copy.experience.plusOne} checked={state.experience.allowPlusOneDefault} onChange={(value) => dispatch({ type: 'SET_FIELD', section: 'experience', field: 'allowPlusOneDefault', value })} />
      </section>
    </aside>
  </div></>;
}

function RecipientsArea({ copy, isArabic }) {
  const { state, dispatch } = useCampaignStudio();
  return <><AreaIntro copy={copy} index={3} /><div className="jzs-recipient-actions"><button className="jzs-action" type="button">＋ {copy.recipients.add}</button><button className="jzs-action jzs-action--ghost" type="button">{copy.recipients.upload}</button><button className="jzs-text-action" type="button">{copy.recipients.template}</button><span>{copy.recipients.cap}</span></div>
    <div className="jzs-recipient-list">{state.recipients.orderedIds.map((id) => { const item = state.recipients.entitiesById[id]; const valid = item.status === 'valid'; return <article key={id} className={`${state.studio.selectedRecipientId === id ? 'is-selected ' : ''}is-${item.status}`}>
      <button className="jzs-recipient-main" type="button" disabled={!valid} onClick={() => dispatch({ type: 'SELECT_RECIPIENT', id })}><span className="jzs-avatar">{(isArabic ? item.nameAr : item.name).slice(0, 1)}</span><span><strong>{isArabic ? item.nameAr : item.name}</strong><small className="jzs-ltr">{item.email} · {item.phone}</small></span></button>
      <div className="jzs-recipient-meta"><span className={`jzs-status is-${item.status}`}>{copy.recipients[item.status]}</span><small>{copy.recipients[item.source]}</small></div>
      {valid && <div className="jzs-override"><label>{copy.recipients.plusOne}<select value={item.plusOne} onChange={(e) => dispatch({ type: 'SET_RECIPIENT_OVERRIDE', id, value: e.target.value })}><option value="inherit">{copy.recipients.inherit}</option><option value="allow">{copy.recipients.allow}</option><option value="block">{copy.recipients.block}</option></select></label><button type="button">{copy.recipients.edit}</button><button type="button" onClick={() => dispatch({ type: 'REMOVE_RECIPIENT', id })}>{copy.recipients.remove}</button></div>}
    </article>; })}</div></>;
}

function DeliveryArea({ copy }) {
  const { state, dispatch } = useCampaignStudio();
  return <><AreaIntro copy={copy} index={4} /><div className="jzs-delivery-choice">{['whatsapp', 'email'].map((channel) => <button type="button" key={channel} className={state.delivery.channel === channel ? 'is-active' : ''} onClick={() => dispatch({ type: 'SET_FIELD', section: 'delivery', field: 'channel', value: channel })}><span>{channel === 'whatsapp' ? 'WA' : '@'}</span><strong>{copy.delivery[channel]}</strong><small>{copy.delivery[`${channel}Body`]}</small></button>)}</div><div className="jzs-development-note"><span>{copy.delivery.preview}</span><strong>{copy.delivery.noSend}</strong><small>{copy.delivery.launch}</small></div></>;
}

function ReviewArea({ copy }) {
  const { state } = useCampaignStudio(); const difficulty = PIECE_OPTIONS.find((item) => item.id === state.puzzle.difficultyId);
  const rows = [[copy.review.campaign, state.campaign.name], [copy.review.puzzle, `${difficulty.count} ${copy.puzzle.pieces}${state.puzzle.mysteryMode ? ` · ${copy.puzzle.mystery}` : ''}`], [copy.review.event, `${state.experience.eventTitle} · ${state.experience.location}`], [copy.review.recipients, copy.review.validCount], [copy.review.delivery, copy.delivery[state.delivery.channel]], [copy.review.policy, copy.review.policyValue], [copy.review.expiry, state.experience.rsvpDeadline]];
  return <><AreaIntro copy={copy} index={5} /><div className="jzs-review"><span className="jzs-review__piece" aria-hidden="true">J</span><div>{rows.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div></div><div className="jzs-launch"><span><b>✓</b><span><strong>{copy.review.ready}</strong><small>{copy.review.launch}</small></span></span><button type="button" disabled>{copy.review.launchNow}</button></div></>;
}

function AreaIntro({ copy, index }) { return <header className="jzs-area-intro"><span className="jzs-eyebrow">{copy.eyebrow[index]}</span><h1>{copy[["campaign","puzzle","experience","recipients","delivery","review"][index]].title}</h1><p>{copy[["campaign","puzzle","experience","recipients","delivery","review"][index]].body}</p></header>; }

function Studio() {
  const { i18n } = useTranslation(); const { state, dispatch } = useCampaignStudio();
  const isArabic = i18n.language.startsWith('ar'); const copy = studioCopy[isArabic ? 'ar' : 'en']; const ActiveArea = [CampaignArea, PuzzleArea, ExperienceArea, RecipientsArea, DeliveryArea, ReviewArea][state.studio.activeArea];
  useEffect(() => { document.documentElement.dir = isArabic ? 'rtl' : 'ltr'; document.documentElement.lang = isArabic ? 'ar' : 'en'; document.title = isArabic ? 'استوديو حملات JIGZO' : 'JIGZO Campaign Studio'; }, [isArabic]);
  return <div className="jzs-page" dir={isArabic ? 'rtl' : 'ltr'}>
    <header className="jzs-header"><Link to="/business" className="jzs-brand"><img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" /><span>{copy.brand}</span></Link><div><span className={`jzs-draft is-${state.studio.saveState}`} title={state.studio.saveError}>{copy.draft} · {state.studio.saveState === 'saving' || state.studio.saveState === 'loading' ? copy.saving : state.studio.saveState === 'saved' ? copy.saved : copy.saveError}</span><button type="button" className="jzs-lang" onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}>{copy.language}</button></div></header>
    <div className="jzs-mobile-context"><b className="jzs-ltr">{String(state.studio.activeArea + 1).padStart(2, '0')} / 06</b><span>·</span><strong>{copy.areas[state.studio.activeArea]}</strong></div>
    <main className="jzs-workspace">
      <nav className="jzs-rail" aria-label={copy.brand}><Link to="/business">← <span>{copy.back}</span></Link><ol>{copy.areas.map((area, index) => <li key={area}><button type="button" className={state.studio.activeArea === index ? 'is-active' : ''} onClick={() => dispatch({ type: 'SET_AREA', area: index })}><i>{String(index + 1).padStart(2, '0')}</i><span><strong>{area}</strong><small>{copy.areaNotes[index]}</small></span><b aria-hidden="true">{state.studio.visitedAreas.includes(index) ? '•' : ''}</b></button></li>)}</ol></nav>
      <section className="jzs-canvas"><ActiveArea copy={copy} isArabic={isArabic} /><div className="jzs-mobile-nav"><button type="button" disabled={state.studio.activeArea === 0} onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea - 1 })}>{copy.common.previous}</button><span>{state.studio.activeArea + 1} / 6</span><button type="button" disabled={state.studio.activeArea === 5} onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea + 1 })}>{copy.common.next}</button></div></section>
      <PhonePreview copy={copy} isArabic={isArabic} />
    </main>
  </div>;
}

export default function BusinessCampaignStudioPage() { const { campaignId } = useParams(); const navigate = useNavigate(); const onCreated = useCallback((id) => navigate(`/business/campaigns/${id}`, { replace: true }), [navigate]); return <CampaignStudioProvider campaignId={campaignId} onCreated={onCreated}><Studio /></CampaignStudioProvider>; }
