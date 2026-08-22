import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CampaignStudioProvider, useCampaignStudio } from '../../business/studio/CampaignStudioContext';
import { studioCopy } from '../../business/studio/studio-copy';
import BusinessPuzzle from '../../business/landing/BusinessPuzzle';
import BusinessImageCropModal from '../../business/studio/BusinessImageCropModal';
import PhoneJourneyAnimation from '../../business/journey/PhoneJourneyAnimation';
import { businessJourneyCopy } from '../../business/journey/businessJourneyCopy';
import { PIECE_OPTIONS } from '../../config/difficulties';
import { businessApi } from '../../services/businessApi';
import { prepareBusinessImage } from '../../business/studio/business-image-upload';
import { rememberBusinessReturnTo } from '../../business/auth/businessAccess';
import { zonedTimeToUtcIso, formatZonedDisplay } from '../../business/studio/timezone-utils';
import '../../business/studio/business-studio.css';
import '../../business/journey/business-journey.css';

const AREA_KEYS = ['campaign', 'puzzle', 'experience', 'recipients', 'delivery', 'review'];

function fillTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template);
}
function formatEventDateTime(value, isArabic) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(isArabic ? 'ar' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function formatShortDate(value, isArabic) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(isArabic ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' });
}

function Toggle({ checked, onChange, label, description }) {
  return <label className="jzs-toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i aria-hidden="true" /></label>;
}
function Field({ label, children, wide = false }) {
  return <label className={`jzs-field${wide ? ' jzs-field--wide' : ''}`}><span>{label}</span>{children}</label>;
}
function AreaIntro({ copy, index }) {
  const key = AREA_KEYS[index];
  return <header className="jzs-area-intro"><span className="jzs-eyebrow">{copy.eyebrow[index]}</span><h1>{copy[key].title}</h1><p>{copy[key].body}</p></header>;
}
function computeScheduleErrors(state, copy) {
  const errors = [];
  if (!state.schedule.date || !state.schedule.time) return errors;
  const iso = zonedTimeToUtcIso(state.schedule.date, state.schedule.time, state.experience.timezone);
  if (!iso) return errors;
  const scheduled = new Date(iso);
  if (scheduled <= new Date()) errors.push(copy.delivery.sendTiming.pastError);
  if (state.experience.rsvpEnabled && state.experience.rsvpDeadline) {
    const deadline = new Date(state.experience.rsvpDeadline);
    if (!Number.isNaN(deadline.getTime()) && scheduled >= deadline) errors.push(copy.delivery.sendTiming.rsvpError);
  }
  return errors;
}

// The right-rail preview lives INSIDE the phone shell (the device framing is part of
// how Studio communicates "this is what your guest experiences"). Unlike the recipient
// page's own step-by-step journey (arrival -> solve -> revealed, each a distinct phase
// the guest actively drives), the Studio phone shows that whole journey as ONE
// continuous animated loop — envelope arrival/open, pieces spill/pile, pieces assemble
// onto the real selected Business grid, crossfade into the actual complete puzzle,
// reveal into the invitation, RSVP hold, then loop — via PhoneJourneyAnimation, so
// owners see the guest experience unfold through motion rather than static mockups.
function RecipientJourneyPreview({ copy, isArabic }) {
  const { state, dispatch } = useCampaignStudio();
  const pieceCount = PIECE_OPTIONS.find((option) => option.id === state.puzzle.difficultyId)?.count || 18;
  const recipient = state.studio.previewRecipient || state.recipients.entitiesById[state.studio.selectedRecipientId];
  const recipientName = recipient?.displayName || recipient?.name || '';
  const firstName = recipientName ? recipientName.split(' ')[0] : copy.preview.select;
  const plusOne = recipient ? (recipient.plusOneOverride === 'allowed' || (recipient.plusOneOverride === 'inherit' && state.experience.allowPlusOneDefault)) : state.experience.allowPlusOneDefault;
  const cycle = () => {
    const ids = state.recipients.orderedIds; if (ids.length < 2) return;
    const currentIndex = Math.max(0, ids.indexOf(state.studio.selectedRecipientId));
    dispatch({ type: 'SELECT_RECIPIENT', id: ids[(currentIndex + 1) % ids.length] });
  };
  const jc = businessJourneyCopy[isArabic ? 'ar' : 'en'];
  const revealedCopy = { invited: copy.preview.invitation, when: copy.preview.when, where: copy.preview.where, going: copy.preview.going, plus: copy.preview.guest, notGoing: copy.preview.notGoing };
  return <aside className="jzs-preview" aria-label={fillTemplate(copy.preview.label, { name: firstName })}>
    <div className="jzs-preview__heading">
      <span>{fillTemplate(copy.preview.label, { name: firstName })}</span>
      {state.recipients.orderedIds.length > 1 && <button type="button" className="jzs-preview__cycle" onClick={cycle}>{copy.preview.nextGuest}</button>}
    </div>
    <div className="jzs-phone-wrap">
      <div className="jzs-phone"><div className="jzs-phone__screen">
        <span className="jzs-phone__island" />
        <div className="jzs-phone__top"><span>9:41</span><span className="jzs-ltr">JIGZO</span></div>
        <div className="jzs-phone__body">
          <div className="jzs-phone__brand-row"><img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" /></div>
          <PhoneJourneyAnimation
            pieceCount={pieceCount}
            imageUrl={state.puzzle.imagePreviewUrl}
            mysteryMode={state.puzzle.mysteryMode}
            eventTitle={state.experience.eventTitle}
            whenDisplay={formatEventDateTime(state.experience.dateTime, isArabic)}
            location={state.experience.location}
            message={state.experience.message}
            rsvpEnabled={state.experience.rsvpEnabled}
            allowPlusOne={plusOne}
            copy={jc}
            revealedCopy={revealedCopy}
            isArabic={isArabic}
          />
        </div>
      </div></div>
    </div>
  </aside>;
}

function CampaignArea({ copy }) {
  const { state, dispatch } = useCampaignStudio();
  return <>
    <AreaIntro copy={copy} index={0} />
    <Field label={copy.campaign.name} wide><input dir="auto" value={state.campaign.name} onChange={(e) => dispatch({ type: 'SET_FIELD', section: 'campaign', field: 'name', value: e.target.value })} /></Field>
    <div className="jzs-label">{copy.campaign.experience}</div>
    <div className="jzs-format-grid">
      <div className="jzs-format-card is-active">
        <div className="jzs-format-card__head"><strong>{copy.campaign.invitation}</strong><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></div>
        <small>{copy.campaign.invitationBody}</small>
      </div>
      <div className="jzs-format-card jzs-format-card--placeholder">
        <strong>{copy.campaign.notOpenTitle}</strong>
        <small>{copy.campaign.notOpenBody}</small>
      </div>
    </div>
  </>;
}

function PuzzleArea({ copy, isArabic }) {
  const { state, dispatch } = useCampaignStudio();
  const pieceCount = PIECE_OPTIONS.find((option) => option.id === state.puzzle.difficultyId)?.count || 18;
  const fileInput = useRef(null);
  const [uploadState, setUploadState] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const uploadReady = Boolean(state.sync.hydrated && state.identity.campaignId);
  const hasImage = Boolean(state.puzzle.imagePreviewUrl);
  const selectImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!uploadReady) { setUploadState('Wait for this campaign to finish saving.'); return; }
    setUploadState('');
    const reader = new FileReader();
    reader.onload = (e) => setCropSrc(e.target.result);
    reader.readAsDataURL(file);
  };
  const applyCrop = async (croppedBlob) => {
    setCropSrc(null);
    try {
      setUploadState('Saving…');
      const prepared = await prepareBusinessImage(croppedBlob);
      await businessApi.persistPuzzle(state.identity.campaignId, prepared.blob);
      dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'imagePreviewUrl', value: prepared.previewUrl });
      setUploadState('');
    } catch (error) {
      const responseError = error.response?.data?.error;
      setUploadState(responseError?.message || responseError || error.message || 'Could not save image.');
    }
  };
  return <>
    {cropSrc && <BusinessImageCropModal imgSrc={cropSrc} copy={copy} isArabic={isArabic} onCancel={() => setCropSrc(null)} onDone={applyCrop} />}
    <div className="jzs-puzzle-head">
      <AreaIntro copy={copy} index={1} />
      <button type="button" className="jzs-action jzs-action--ghost jzs-action--sm" disabled={!uploadReady} onClick={() => fileInput.current?.click()}>{hasImage ? copy.puzzle.replace : copy.puzzle.upload}</button>
      <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
    </div>
    <div className="jzs-puzzle-hero">
      <BusinessPuzzle finalPiece={7} pieceCount={pieceCount} imageUrl={state.puzzle.imagePreviewUrl} mysteryMode={state.puzzle.mysteryMode} label={hasImage ? undefined : copy.puzzle.mocked} />
      <div className="jzs-puzzle-hero__badge">{pieceCount} {copy.puzzle.pieces}</div>
    </div>
    {uploadState && <small className="jzs-help" style={{ display: 'block', marginTop: 8, color: 'var(--ink-500)', fontSize: 13 }}>{uploadState}</small>}
    <div className="jzs-label" style={{ marginTop: 24 }}>{copy.puzzle.difficulty}</div>
    <div className="jzs-difficulty-grid">
      {PIECE_OPTIONS.map((option) => <button type="button" key={option.id} className={`jzs-difficulty-card${state.puzzle.difficultyId === option.id ? ' is-active' : ''}`} onClick={() => dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'difficultyId', value: option.id })}>
        <div className="jzs-difficulty-card__art"><BusinessPuzzle finalPiece={-1} pieceCount={option.count} /></div>
        <div className="jzs-difficulty-card__count"><strong>{option.count}</strong><span>{copy.puzzle.pieces}</span></div>
        <div className="jzs-difficulty-card__note">{copy.puzzle.difficultyNotes[option.id]}</div>
      </button>)}
    </div>
    <div className="jzs-mystery-card">
      <Toggle label={copy.puzzle.mystery} description={copy.puzzle.mysteryBody} checked={state.puzzle.mysteryMode} onChange={(value) => dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'mysteryMode', value })} />
    </div>
  </>;
}

function ExperienceArea({ copy }) {
  const { state, dispatch } = useCampaignStudio();
  const set = (field) => (e) => dispatch({ type: 'SET_FIELD', section: 'experience', field, value: e.target.value });
  return <><AreaIntro copy={copy} index={2} />
    <div className="jzs-experience-composer">
      <section className="jzs-composer-card jzs-composer-card--invitation">
        <Field label={copy.experience.eventTitle} wide><input dir="auto" value={state.experience.eventTitle} onChange={set('eventTitle')} /></Field>
        <div className="jzs-composer-row">
          <Field label={copy.experience.location}><input dir="auto" value={state.experience.location} onChange={set('location')} /></Field>
          <Field label={copy.experience.date}><input className="jzs-ltr" type="datetime-local" value={state.experience.dateTime} onChange={set('dateTime')} /></Field>
        </div>
        <Field label={copy.experience.message} wide><textarea dir="auto" rows="5" value={state.experience.message} onChange={set('message')} /></Field>
        <div className="jzs-composer-card__help">{copy.experience.messageHelp}</div>
      </section>
      <aside className="jzs-composer-support">
        <section className="jzs-composer-card">
          <h2>{copy.experience.detailsGroup}</h2>
          <Field label={copy.experience.timezone}><select className="jzs-ltr" value={state.experience.timezone} onChange={set('timezone')}><option>Asia/Bahrain</option><option>Asia/Dubai</option><option>Asia/Riyadh</option></select></Field>
          <Field label={copy.experience.deadline}><input className="jzs-ltr" type="date" value={state.experience.rsvpDeadline} onChange={set('rsvpDeadline')} /></Field>
        </section>
        <section className="jzs-composer-card">
          <h2>{copy.experience.policyGroup}</h2>
          <Toggle label={copy.experience.rsvp} description={copy.experience.rsvpBody} checked={state.experience.rsvpEnabled} onChange={(value) => dispatch({ type: 'SET_FIELD', section: 'experience', field: 'rsvpEnabled', value })} />
          <Toggle label={copy.experience.plusOne} description={copy.experience.plusOneBody} checked={state.experience.allowPlusOneDefault} onChange={(value) => dispatch({ type: 'SET_FIELD', section: 'experience', field: 'allowPlusOneDefault', value })} />
        </section>
      </aside>
    </div>
  </>;
}

function RecipientsArea({ copy, isArabic }) {
  const { state, dispatch, recipientActions } = useCampaignStudio();
  const fileRef = useRef(null); const saveTimers = useRef(new Map());
  const [drafts, setDrafts] = useState([]); const [edits, setEdits] = useState({}); const [rowErrors, setRowErrors] = useState({}); const [rowStatus, setRowStatus] = useState({}); const [error, setError] = useState('');
  useEffect(() => () => { for (const timer of saveTimers.current.values()) window.clearTimeout(timer); }, []);
  useEffect(() => { setEdits(current => { const next = { ...current }; for (const id of state.recipients.orderedIds) { const item = state.recipients.entitiesById[id]; if (!next[id]) next[id] = { recipientId: id, name: item.displayName, contactMethod: item.deliveryChannel, contact: item.contact || '', plusOneOverride: item.plusOneOverride }; } return next; }); }, [state.recipients.entitiesById, state.recipients.orderedIds]);
  const blank = () => ({ localId: crypto.randomUUID(), name: '', contactMethod: 'email', contact: '', plusOneOverride: 'inherit' });
  const validation = row => { const fields = {}; if (!row.name.trim()) fields.name = isArabic ? 'الاسم مطلوب' : 'Name required'; if (!['email', 'whatsapp'].includes(row.contactMethod)) fields.contactMethod = isArabic ? 'اختر وسيلة تواصل' : 'Choose a contact method'; if (row.contactMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact.trim())) fields.contact = isArabic ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Invalid email format'; if (row.contactMethod === 'whatsapp' && !/^\+[1-9]\d{7,14}$/.test(row.contact.replace(/[\s()-]/g, ''))) fields.contact = isArabic ? 'رقم الهاتف غير صحيح' : 'Phone number doesn’t look right'; return fields; };
  const mapImportErrors = codes => { const fields = {}; for (const code of codes || []) { if (code === 'invalid_name') fields.name = isArabic ? 'الاسم مطلوب' : 'Name required'; if (code === 'invalid_delivery_channel') fields.contactMethod = isArabic ? 'اختر البريد أو واتساب' : 'Choose Email or WhatsApp'; if (code === 'invalid_email') fields.contact = isArabic ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Invalid email format'; if (code === 'invalid_phone') fields.contact = isArabic ? 'رقم الهاتف غير صحيح' : 'Phone number doesn’t look right'; if (code === 'duplicate_recipient') fields.contact = isArabic ? 'مستلم مكرر' : 'Duplicate recipient'; } return fields; };
  const persistRow = async (row, isDraft, id) => { try { if (isDraft) { await recipientActions.create(row); setDrafts(value => value.filter(item => item.localId !== id)); } else await recipientActions.update(id, row); setRowErrors(value => ({ ...value, [id]: {} })); setRowStatus(value => ({ ...value, [id]: 'saved' })); } catch (e) { const message = e.response?.data?.code?.includes('DUPLICATE') || e.response?.status === 409 ? (isArabic ? 'مستلم مكرر' : 'Duplicate recipient') : (e.response?.data?.error || copy.recipients.failed); setRowErrors(value => ({ ...value, [id]: { contact: message } })); setRowStatus(value => ({ ...value, [id]: 'error' })); } };
  const scheduleSave = (row, isDraft, id) => { const fields = validation(row); setRowErrors(value => ({ ...value, [id]: fields })); if (saveTimers.current.has(id)) window.clearTimeout(saveTimers.current.get(id)); if (Object.keys(fields).length) { setRowStatus(value => ({ ...value, [id]: '' })); return; } setRowStatus(value => ({ ...value, [id]: 'saving' })); saveTimers.current.set(id, window.setTimeout(() => persistRow(row, isDraft, id), 650)); };
  const change = (row, id, field, value, isDraft) => { const next = { ...row, [field]: value }; if (isDraft) setDrafts(rows => rows.map(item => item.localId === id ? next : item)); else setEdits(rows => ({ ...rows, [id]: next })); dispatch({ type: 'PREVIEW_RECIPIENT', recipient: { ...next, displayName: next.name } }); scheduleSave(next, isDraft, id); };
  const download = async () => { const blob = await businessApi.downloadRecipientTemplate(state.identity.campaignId); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'jigzo-recipient-template-v1.csv'; a.click(); URL.revokeObjectURL(url); };
  const upload = async event => { const file = event.target.files?.[0]; if (!file) return; setError(''); try { const result = await businessApi.validateRecipientImport(state.identity.campaignId, file); await businessApi.commitRecipientImport(state.identity.campaignId, result.import.importId); const unresolved = (result.editableRows || []).filter(row => row.classification !== 'ready').map(row => ({ ...row, localId: crypto.randomUUID() })); setDrafts(value => [...value, ...unresolved]); setRowErrors(value => ({ ...value, ...Object.fromEntries(unresolved.map(row => [row.localId, mapImportErrors(row.validationErrors)])) })); await recipientActions.reload(); } catch (e) { setError(e.response?.data?.error || copy.recipients.failed); } event.target.value = ''; };
  const persistedRows = state.recipients.orderedIds.map(id => edits[id]).filter(Boolean); const rows = [...persistedRows, ...drafts]; const attention = Object.values(rowErrors).filter(fields => Object.values(fields || {}).some(Boolean)).length;
  const plusOn = row => row.plusOneOverride === 'allowed' || (row.plusOneOverride === 'inherit' && state.experience.allowPlusOneDefault);
  return <div className="jzs-recipients-workspace">
    <div className="jzs-recipient-toolbar">
      <AreaIntro copy={copy} index={3} />
      <div className="jzs-recipient-toolbar__actions">
        <button className="jzs-action jzs-action--ghost jzs-action--sm" type="button" onClick={download}>{copy.recipients.template}</button>
        <button className="jzs-action jzs-action--ghost jzs-action--sm" type="button" onClick={() => fileRef.current?.click()}>{copy.recipients.upload}</button>
        <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={upload} />
        <button className="jzs-action jzs-action--sm" type="button" onClick={() => setDrafts(value => [...value, blank()])} disabled={rows.length >= 2000}>{copy.recipients.add}</button>
      </div>
    </div>
    <div className="jzs-recipient-stats">
      <div><strong>{rows.length}</strong> {copy.recipients.count}</div>
      <div className="jzs-dot" />
      <div><strong>{rows.length - attention}</strong> {copy.recipients.ready}</div>
      {attention > 0 && <><div className="jzs-dot" /><div className="is-warning">{attention} {copy.recipients.needAttention}</div></>}
      <div className="jzs-recipient-stats__saved"><i />{copy.recipients.savedAuto}</div>
    </div>
    {error && <div className="jzs-note"><strong>{error}</strong></div>}
    <div className="jzs-recipient-grid" role="table">
      <div className="jzs-recipient-grid__head" role="row"><span>{copy.recipients.name}</span><span>{copy.recipients.contactMethod}</span><span>{copy.recipients.contact}</span><span>{copy.recipients.plusOne}</span><span /></div>
      {rows.map(row => {
        const isDraft = Boolean(row.localId), id = row.localId || row.recipientId, fields = rowErrors[id] || {}, status = rowStatus[id];
        const on = plusOn(row);
        const focus = () => { dispatch({ type: 'PREVIEW_RECIPIENT', recipient: { ...row, displayName: row.name } }); if (row.recipientId) dispatch({ type: 'SELECT_RECIPIENT', id: row.recipientId }); };
        return <div className={`jzs-recipient-row${Object.values(fields).some(Boolean) ? ' has-error' : ''}${state.studio.selectedRecipientId === row.recipientId ? ' is-selected' : ''}`} role="row" key={id} onFocus={focus}>
          <div className="jzs-recipient-row__grid">
            <label><span>{fields.name}</span><input aria-label={copy.recipients.name} value={row.name} onChange={e => change(row, id, 'name', e.target.value, isDraft)} /></label>
            <label><span>{fields.contactMethod}</span><select aria-label={copy.recipients.contactMethod} value={row.contactMethod} onChange={e => change(row, id, 'contactMethod', e.target.value, isDraft)}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>
            <label><span>{fields.contact}</span><input className="jzs-ltr" aria-label={copy.recipients.contact} type={row.contactMethod === 'email' ? 'email' : 'tel'} value={row.contact} placeholder={row.contactMethod === 'whatsapp' ? '+973XXXXXXXX' : 'name@example.com'} onChange={e => change(row, id, 'contact', e.target.value, isDraft)} /></label>
            <button type="button" className={`jzs-plus-toggle${on ? ' is-on' : ''}`} aria-label={copy.recipients.plusOne} onClick={() => change(row, id, 'plusOneOverride', on ? 'not_allowed' : 'allowed', isDraft)}>{on ? copy.common.on : copy.common.off}</button>
            <div className="jzs-recipient-row__actions">
              <span className={`jzs-save-dot is-${status || 'idle'}`} title={status === 'saving' ? (isArabic ? 'جارٍ الحفظ…' : 'Saving…') : status === 'saved' ? (isArabic ? 'تم الحفظ' : 'Saved') : undefined} />
              <button type="button" aria-label={isArabic ? 'إزالة المستلم' : 'Remove recipient'} onClick={() => isDraft ? setDrafts(value => value.filter(item => item.localId !== id)) : recipientActions.remove(id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9v9m4-9v9m4-9v9M5 6h14M9 6V4h6v2m3 0-1 15H7L6 6" /></svg></button>
            </div>
          </div>
        </div>;
      })}
    </div>
    <button className="jzs-add-recipient" type="button" disabled={rows.length >= 2000} onClick={() => setDrafts(value => [...value, blank()])}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{copy.recipients.add}
    </button>
    {!state.recipients.loading && !rows.length && <div className="jzs-empty"><span className="jzs-piece-mark" /><h2>{copy.recipients.emptyTitle}</h2><p>{copy.recipients.emptyBody}</p></div>}
  </div>;
}

function DeliveryArea({ copy, isArabic, validation, refreshDelivery, emailReadyCount, waReadyCount, waBlocked, goToRecipients }) {
  const { state, dispatch } = useCampaignStudio();
  const [testEmail, setTestEmail] = useState(''); const [message, setMessage] = useState('');
  const readyTotal = emailReadyCount + waReadyCount;
  const scheduleErrors = computeScheduleErrors(state, copy);
  const setSchedule = (field) => (e) => dispatch({ type: 'SET_FIELD', section: 'schedule', field, value: e.target.value });
  const testSend = async () => {
    const recipientId = state.studio.selectedRecipientId || state.recipients.orderedIds[0];
    if (!recipientId) { setMessage(isArabic ? 'أضف مستلماً أولاً.' : 'Add a recipient first.'); return; }
    try { await businessApi.sendDeliveryTest(state.identity.campaignId, { recipientId, email: testEmail }, crypto.randomUUID()); setMessage(isArabic ? 'تمت جدولة رسالة الاختبار.' : 'Test email queued.'); await refreshDelivery(); }
    catch (e) { setMessage(e.response?.data?.error || 'Test send failed.'); }
  };
  return <>
    <AreaIntro copy={copy} index={4} />
    <div className="jzs-delivery-summary">
      <div className="jzs-delivery-summary__ready"><strong>{readyTotal}</strong><span>{readyTotal === 1 ? copy.delivery.readyLabelSingular : copy.delivery.readyLabel}</span></div>
      <div className="jzs-channel-grid">
        <div className="jzs-channel-card">
          <div className="jzs-channel-card__head"><strong>{copy.delivery.email}</strong><span className="jzs-pill is-active">{emailReadyCount > 0 ? copy.delivery.emailStatus : copy.delivery.emailIdleStatus}</span></div>
          <div className="jzs-channel-card__count">{emailReadyCount}</div>
          <div className="jzs-channel-card__caption">{emailReadyCount === 1 ? copy.delivery.emailCaptionSingular : copy.delivery.emailCaption}</div>
        </div>
        <div className={`jzs-channel-card${waBlocked ? ' is-blocked' : ''}`}>
          <div className="jzs-channel-card__head"><strong>{copy.delivery.whatsapp}</strong><span className="jzs-pill is-draft">{waBlocked ? copy.delivery.whatsappPillBlocked : copy.delivery.whatsappPillMoved}</span></div>
          <div className="jzs-channel-card__count">{waReadyCount}</div>
          <div className="jzs-channel-card__caption">{waBlocked ? (waReadyCount === 1 ? copy.delivery.whatsappCaptionSingular : copy.delivery.whatsappCaption) : copy.delivery.whatsappCaptionMoved}</div>
        </div>
      </div>
    </div>
    <div className="jzs-mystery-card" style={{ marginTop: 16, flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
      <strong>{copy.delivery.sendTiming.title}</strong>
      <div className="jzs-format-grid">
        <button type="button" className={`jzs-format-card jzs-format-card--compact${state.schedule.mode === 'now' ? ' is-active' : ''}`} onClick={() => dispatch({ type: 'SET_FIELD', section: 'schedule', field: 'mode', value: 'now' })}>
          <div className="jzs-format-card__head"><strong>{copy.delivery.sendTiming.sendNow}</strong></div>
        </button>
        <button type="button" className={`jzs-format-card jzs-format-card--compact${state.schedule.mode === 'later' ? ' is-active' : ''}`} onClick={() => dispatch({ type: 'SET_FIELD', section: 'schedule', field: 'mode', value: 'later' })}>
          <div className="jzs-format-card__head"><strong>{copy.delivery.sendTiming.scheduleLater}</strong></div>
        </button>
      </div>
      {state.schedule.mode === 'later' && <>
        <div className="jzs-composer-row">
          <Field label={copy.delivery.sendTiming.dateLabel}><input className="jzs-ltr" type="date" value={state.schedule.date} onChange={setSchedule('date')} /></Field>
          <Field label={copy.delivery.sendTiming.timeLabel}><input className="jzs-ltr" type="time" value={state.schedule.time} onChange={setSchedule('time')} /></Field>
        </div>
        <small className="jzs-help">{copy.delivery.sendTiming.formatHint}</small>
        <small className="jzs-help">{copy.delivery.sendTiming.timezoneLabel}: {state.experience.timezone}</small>
        {scheduleErrors.map(err => <small key={err} style={{ color: 'var(--danger)', display: 'block' }}>{err}</small>)}
      </>}
    </div>
    {waBlocked && <div className="jzs-blocked-banner">
      <strong>{waReadyCount} {copy.delivery.blockedTitle}</strong>
      <p>{copy.delivery.blockedBody}</p>
      <div className="jzs-blocked-banner__actions">
        <button type="button" className="jzs-action jzs-action--sm" onClick={goToRecipients}>{copy.delivery.fixInRecipients}</button>
        <button type="button" className="jzs-action jzs-action--ghost jzs-action--sm" onClick={goToRecipients}>{copy.delivery.seeWho}</button>
      </div>
    </div>}
    <div className="jzs-test-send">
      <strong>{copy.delivery.testTitle}</strong>
      <p>{copy.delivery.testBody}</p>
      <div className="jzs-test-send__row">
        <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder={copy.delivery.testPlaceholder} />
        <button type="button" className="jzs-action jzs-action--sm" onClick={testSend}>{copy.delivery.testButton}</button>
      </div>
      {message && <small>{message}</small>}
    </div>
  </>;
}

function ReviewArea({ copy, isArabic, validation, refreshDelivery, emailReadyCount, waReadyCount, waBlocked, goToRecipients, onLaunched }) {
  const { state, dispatch } = useCampaignStudio();
  const [message, setMessage] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const difficulty = PIECE_OPTIONS.find((item) => item.id === state.puzzle.difficultyId);
  const totalRecipients = state.recipients.orderedIds.length;
  const canLaunch = Boolean(validation?.valid);
  const launching = ['sending', 'active'].includes(state.identity.status);
  const isLater = state.schedule.mode === 'later';
  const scheduleErrors = computeScheduleErrors(state, copy);
  const scheduledSendAtIso = isLater && state.schedule.date && state.schedule.time ? zonedTimeToUtcIso(state.schedule.date, state.schedule.time, state.experience.timezone) : null;
  const canSchedule = canLaunch && Boolean(scheduledSendAtIso) && scheduleErrors.length === 0;
  const scheduledDisplay = scheduledSendAtIso ? fillTemplate(copy.review.scheduleSummary, { ...formatZonedDisplay(scheduledSendAtIso, state.experience.timezone, isArabic), timezone: state.experience.timezone }) : '';
  const isScheduled = state.identity.status === 'scheduled';
  const rows = [
    { label: copy.review.campaign, value: state.campaign.name, detail: copy.campaign.invitation, area: 0 },
    { label: copy.review.puzzle, value: `${difficulty.count} ${copy.puzzle.pieces}${state.puzzle.mysteryMode ? ` · ${copy.puzzle.mystery}` : ''}`, detail: copy.puzzle.title, area: 1 },
    { label: copy.review.event, value: state.experience.eventTitle || '—', detail: [state.experience.location, formatShortDate(state.experience.dateTime, isArabic)].filter(Boolean).join(' · '), area: 2 },
    { label: copy.review.guests, value: `${totalRecipients} ${copy.review.peopleWord}`, detail: copy.review.rowsAllComplete, area: 3 },
    { label: copy.review.delivery, value: waBlocked ? `${emailReadyCount} ${copy.review.byEmail}, ${waReadyCount} ${copy.review.waiting}` : `${totalRecipients} ${copy.review.byEmail}`, detail: copy.review.sentByJigzo, area: 4 },
    { label: copy.review.replies, value: state.experience.rsvpEnabled ? `${copy.review.openUntil} ${formatShortDate(state.experience.rsvpDeadline, isArabic)}` : copy.review.notAsking, detail: state.experience.allowPlusOneDefault ? copy.review.plusAllowed : copy.review.noPlusOnes, area: 2 }
  ];
  const launch = async () => {
    try { await businessApi.launchCampaign(state.identity.campaignId); onLaunched(); }
    catch (e) { setMessage(e.response?.data?.error || 'Launch failed.'); await refreshDelivery(); }
  };
  const schedule = async () => {
    if (!scheduledSendAtIso) return;
    setScheduling(true); setMessage('');
    try { const result = await businessApi.scheduleCampaign(state.identity.campaignId, scheduledSendAtIso); dispatch({ type: 'HYDRATE', campaign: result.campaign }); }
    catch (e) { setMessage(e.response?.data?.error || 'Scheduling failed.'); }
    finally { setScheduling(false); }
  };
  return <>
    <AreaIntro copy={copy} index={5} />
    <div className="jzs-recap">
      {rows.map(row => <button type="button" className="jzs-recap-row" key={row.label} onClick={() => dispatch({ type: 'SET_AREA', area: row.area })}>
        <span className="jzs-eyebrow">{row.label}</span>
        <span><span className="jzs-recap-row__value" dir="auto">{row.value}</span><span className="jzs-recap-row__detail" dir="auto">{row.detail}</span></span>
        <span className="jzs-recap-row__edit">{copy.review.edit}</span>
      </button>)}
    </div>
    {waBlocked && <div className="jzs-blocked-banner">
      <strong>{waReadyCount} {copy.review.stillWaitingTitle}</strong>
      <p>{copy.review.stillWaitingBody}</p>
      <div className="jzs-blocked-banner__actions"><button type="button" className="jzs-action jzs-action--sm" onClick={goToRecipients}>{copy.delivery.fixInRecipients}</button></div>
    </div>}
    <div className="jzs-launch-panel">
      {isLater ? (isScheduled ? <>
        <div><strong>{copy.review.scheduledHeadline}</strong><small>{scheduledDisplay || `${totalRecipients} ${copy.review.scheduledSub}`}</small></div>
        <button type="button" className="jzs-action jzs-action--cream" disabled={!canSchedule || launching || scheduling} onClick={schedule}>{copy.review.changeSchedule}</button>
      </> : <>
        <div><strong>{copy.review.notScheduledHeadline}</strong><small>{canSchedule ? copy.review.notScheduledReadySub : copy.review.notScheduledSub}</small></div>
        <button type="button" className="jzs-action jzs-action--cream" disabled={!canSchedule || launching || scheduling} onClick={schedule}>{copy.review.scheduleButton}</button>
      </>) : <>
        <div><strong>{canLaunch ? copy.review.readyHeadline : copy.review.notReadyHeadline}</strong><small>{canLaunch ? `${totalRecipients} ${copy.review.readySub}` : copy.review.notReadySub}</small></div>
        <button type="button" className="jzs-action jzs-action--cream" disabled={!canLaunch || launching} onClick={launch}>{copy.review.launchNow}</button>
      </>}
    </div>
    {message && <div className="jzs-note"><strong>{message}</strong></div>}
  </>;
}

function SendingScreen({ copy, campaignId, onDone, ready }) {
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    let cancelled = false; let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try { const p = await businessApi.getDeliveryProgress(campaignId); if (cancelled) return; setProgress(p); if (attempts < 4) window.setTimeout(poll, 1200); }
      catch { /* real launches are async; a poll failure just stops refining the count, the Continue action below is always available */ }
    };
    poll();
    return () => { cancelled = true; };
  }, [campaignId]);
  const total = progress?.progress?.total ?? ready ?? 0;
  const sent = progress?.progress?.sent ?? 0;
  const pct = total ? Math.round((sent / total) * 100) : 0;
  return <div className="jzs-sending"><div className="jzs-sending__card">
    <img src="/assets/jigzo-brand-icon-1080.png" alt="" />
    <h1>{copy.sending.headline}</h1>
    <p>{sent} {fillTemplate(total === 1 ? copy.sending.captionSingular : copy.sending.caption, { total })}</p>
    <div className="jzs-sending__bar"><i style={{ width: `${pct}%` }} /></div>
    <div className="jzs-sending__note">{copy.sending.note}</div>
    <button type="button" className="jzs-action jzs-action--cream" onClick={onDone}>{copy.sending.continueLabel}</button>
  </div></div>;
}

function Studio() {
  const { i18n } = useTranslation();
  const { state, dispatch } = useCampaignStudio();
  const isArabic = i18n.language.startsWith('ar'); const copy = studioCopy[isArabic ? 'ar' : 'en'];
  const [phase, setPhase] = useState('editing');
  const [validation, setValidation] = useState(null);
  const [progress, setProgress] = useState(null);
  const refreshDelivery = useCallback(async () => {
    if (!state.identity.campaignId) return;
    try { const [v, p] = await Promise.all([businessApi.getDeliveryValidation(state.identity.campaignId), businessApi.getDeliveryProgress(state.identity.campaignId)]); setValidation(v); setProgress(p); } catch { /* aside checklist just shows the last known status */ }
  }, [state.identity.campaignId]);
  useEffect(() => { refreshDelivery(); }, [refreshDelivery, state.studio.activeArea]);
  useEffect(() => { document.documentElement.dir = isArabic ? 'rtl' : 'ltr'; document.documentElement.lang = isArabic ? 'ar' : 'en'; document.title = isArabic ? 'استوديو حملات JIGZO' : 'JIGZO Campaign Studio'; }, [isArabic]);

  const readyRecipients = useMemo(() => state.recipients.orderedIds.map(id => state.recipients.entitiesById[id]).filter(Boolean), [state.recipients]);
  const emailReadyCount = readyRecipients.filter(r => r.deliveryChannel === 'email').length;
  const waReadyCount = readyRecipients.filter(r => r.deliveryChannel === 'whatsapp').length;
  const waBlocked = waReadyCount > 0;
  const goToRecipients = () => dispatch({ type: 'SET_AREA', area: 3 });
  const onLaunched = () => setPhase('sending');
  const onSendingDone = () => { setPhase('editing'); refreshDelivery(); };

  if (phase === 'sending') return <SendingScreen copy={copy} campaignId={state.identity.campaignId} onDone={onSendingDone} ready={emailReadyCount + waReadyCount} />;

  const ActiveArea = [CampaignArea, PuzzleArea, ExperienceArea, RecipientsArea, DeliveryArea, ReviewArea][state.studio.activeArea];
  const areaProps = { copy, isArabic, validation, progress, refreshDelivery, emailReadyCount, waReadyCount, waBlocked, goToRecipients, onLaunched };

  const checklist = [
    { key: 'campaignNamed', ok: Boolean(state.campaign.name?.trim()), note: state.campaign.name || '' },
    { key: 'imageSet', ok: Boolean(state.puzzle.imagePreviewUrl), note: state.puzzle.imagePreviewUrl ? `${PIECE_OPTIONS.find(o => o.id === state.puzzle.difficultyId)?.count || 18} ${copy.puzzle.pieces}` : '' },
    { key: 'invitationWritten', ok: Boolean(state.experience.eventTitle && state.experience.dateTime && state.experience.location && state.experience.message), note: copy.checklist.invitationNote },
    { key: 'guestsAdded', ok: state.recipients.orderedIds.length > 0, warn: false, note: state.recipients.orderedIds.length > 0 ? fillTemplate(copy.checklist.guestsAddedNote, { count: state.recipients.orderedIds.length, word: state.recipients.orderedIds.length === 1 ? copy.home.recipientSingular : copy.home.recipientsCount }) : '' },
    { key: 'deliveryClear', ok: !waBlocked, warn: waBlocked, note: waBlocked ? fillTemplate(copy.checklist.deliveryWaitingNote, { count: waReadyCount, word: waReadyCount === 1 ? copy.home.recipientSingular : copy.home.recipientsCount }) : '' },
    { key: 'readyToSend', ok: Boolean(validation?.valid), warn: validation ? !validation.valid : false, note: validation?.valid ? copy.checklist.readyNote : copy.checklist.notReadyNote }
  ];
  const dotClass = (item) => item.ok ? 'is-ok' : (item.warn ? 'is-warn' : '');

  return <div className="jzs-page jzs-studio" dir={isArabic ? 'rtl' : 'ltr'}>
    <header className="jzs-header">
      <div className="jzs-header__start">
        <Link to="/business/campaigns" className="jzs-header__back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>{copy.back}</Link>
        <span className="jzs-header__title" dir="auto">{state.campaign.name}</span>
      </div>
      <div className="jzs-header__end">
        <span className={`jzs-draft is-${state.studio.saveState}`} title={state.studio.saveError}>{state.studio.saveState === 'saving' || state.studio.saveState === 'loading' ? copy.saving : state.studio.saveState === 'saved' ? copy.saved : copy.saveError}</span>
        <button type="button" className="jzs-lang" onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}>{copy.language}</button>
      </div>
    </header>
    <nav className="jzs-steps">
      {copy.areas.map((area, index) => <button key={area} type="button" className={`jzs-step${state.studio.activeArea === index ? ' is-active' : ''}${state.studio.visitedAreas.includes(index) && state.studio.activeArea !== index ? ' is-done' : ''}`} onClick={() => dispatch({ type: 'SET_AREA', area: index })}>
        <span className="jzs-step__dot" />
        <span className="jzs-step__label"><strong>{area}</strong><small>{copy.areaNotes[index]}</small></span>
      </button>)}
    </nav>
    <main className="jzs-workspace">
      <section className="jzs-canvas">
        <ActiveArea {...areaProps} />
        <div className="jzs-canvas-nav">
          <button type="button" className="jzs-action jzs-action--ghost" style={{ visibility: state.studio.activeArea === 0 ? 'hidden' : 'visible' }} onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea - 1 })}>{copy.common.previousTo.replace('{{area}}', copy.areas[Math.max(0, state.studio.activeArea - 1)])}</button>
          {state.studio.activeArea < 5 && <button type="button" className="jzs-action" onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea + 1 })}>{copy.common.nextTo.replace('{{area}}', copy.areas[state.studio.activeArea + 1])}</button>}
        </div>
      </section>
      <RecipientJourneyPreview copy={copy} isArabic={isArabic} />
      <aside className="jzs-context">
        <div className="jzs-context__blurb"><span className="jzs-eyebrow">{copy.aside[state.studio.activeArea].eyebrow}</span><h3>{copy.aside[state.studio.activeArea].title}</h3><p>{copy.aside[state.studio.activeArea].body}</p></div>
        <div className="jzs-checklist">
          <span className="jzs-eyebrow">{copy.checklist.title}</span>
          <div className="jzs-checklist__items">
            {checklist.map(item => <div className="jzs-checklist__item" key={item.key}><span className={`jzs-checklist__dot ${dotClass(item)}`} /><span><strong>{copy.checklist[item.key]}</strong><small>{item.note}</small></span></div>)}
          </div>
        </div>
      </aside>
    </main>
  </div>;
}

export default function BusinessCampaignStudioPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const onCreated = useCallback((id) => navigate(`/business/campaigns/${id}`, { replace: true }), [navigate]);
  const onSessionExpired = useCallback(() => { const returnTo = rememberBusinessReturnTo(window.location.pathname); navigate(`/business/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { reason: 'session-expired' } }); }, [navigate]);
  return <CampaignStudioProvider campaignId={campaignId} onCreated={onCreated} onSessionExpired={onSessionExpired}><StudioWithRedirect navigate={navigate} /></CampaignStudioProvider>;
}

function StudioWithRedirect({ navigate }) {
  const { state } = useCampaignStudio();
  useEffect(() => {
    if (state.identity.campaignId && ['active', 'completed', 'cancelled'].includes(state.identity.status)) {
      navigate(`/business/campaigns/${state.identity.campaignId}/results`, { replace: true });
    }
  }, [state.identity.campaignId, state.identity.status, navigate]);
  if (state.identity.campaignId && ['active', 'completed', 'cancelled'].includes(state.identity.status)) return null;
  return <Studio />;
}
