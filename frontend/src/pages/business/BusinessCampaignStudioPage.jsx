import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CampaignStudioProvider, useCampaignStudio } from '../../business/studio/CampaignStudioContext';
import { studioCopy } from '../../business/studio/studio-copy';
import BusinessPuzzle from '../../business/landing/BusinessPuzzle';
import { PIECE_OPTIONS } from '../../config/difficulties';
import { businessApi } from '../../services/businessApi';
import { prepareBusinessImage } from '../../business/studio/business-image-upload';
import { rememberBusinessReturnTo } from '../../business/auth/businessAccess';
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
  const pieceCount = PIECE_OPTIONS.find((option) => option.id === state.puzzle.difficultyId)?.count || 18;
  const recipient = state.recipients.entitiesById[state.studio.selectedRecipientId];
  const recipientName = recipient?.displayName || copy.preview.select;
  const message = state.experience.message;
  const plusOne = recipient?.plusOneOverride === 'allowed' || (recipient?.plusOneOverride === 'inherit' && state.experience.allowPlusOneDefault);
  return <aside className="jzs-preview" aria-label={copy.preview.label}>
    <div className="jzs-preview__heading"><span>{copy.preview.label}</span><small>{copy.preview.demo}</small></div>
    <div className="jzs-phone">
      <div className="jzs-phone__screen">
        <span className="jzs-phone__island" />
        <div className="jzs-phone__top"><span>JIGZO</span><span className="jzs-ltr">9:41</span></div>
        <div className="jzs-phone__puzzle"><BusinessPuzzle finalPiece={4} pieceCount={pieceCount} imageUrl={state.puzzle.imagePreviewUrl} mysteryMode={state.puzzle.mysteryMode} /></div>
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
  const pieceCount = PIECE_OPTIONS.find((option) => option.id === state.puzzle.difficultyId)?.count || 18;
  const fileInput = useRef(null);
  const [uploadState,setUploadState]=useState('');
  const uploadReady = Boolean(state.sync.hydrated && state.identity.campaignId);
  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!uploadReady) {
      setUploadState('Wait for this campaign to finish saving.');
      return;
    }
    try {
      setUploadState('Saving…');
      const prepared = await prepareBusinessImage(file);
      await businessApi.persistPuzzle(state.identity.campaignId, prepared.blob);
      dispatch({ type: 'SET_FIELD', section: 'puzzle', field: 'imagePreviewUrl', value: prepared.previewUrl });
      setUploadState('Saved');
    } catch (error) {
      const responseError = error.response?.data?.error;
      setUploadState(responseError?.message || responseError || error.message || 'Could not save image.');
    }
  };
  return <>
    <AreaIntro copy={copy} index={1} />
    <div className="jzs-puzzle-stage">
      <div className="jzs-puzzle-art"><BusinessPuzzle finalPiece={7} pieceCount={pieceCount} imageUrl={state.puzzle.imagePreviewUrl} /></div>
      <div><span className="jzs-label">{copy.puzzle.image}</span><button type="button" className="jzs-action" disabled={!uploadReady} onClick={() => fileInput.current?.click()}>{copy.puzzle.upload}</button><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><small className="jzs-help">{uploadState||copy.puzzle.mocked}</small></div>
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
  const { state, dispatch, recipientActions } = useCampaignStudio(); const fileRef = useRef(null); const [form, setForm] = useState(null); const [importReview, setImportReview] = useState(null); const [error, setError] = useState(''); const [results,setResults]=useState({});
  useEffect(()=>{if(state.identity.campaignId)businessApi.getResults(state.identity.campaignId).then(value=>setResults(Object.fromEntries(value.recipients.map(row=>[row.recipientId,row])))).catch(()=>{});},[state.identity.campaignId,state.recipients.orderedIds.length]);
  const copyLink=async id=>{try{const value=await businessApi.issueRecipientLink(state.identity.campaignId,id);await navigator.clipboard.writeText(value.link);setError(isArabic?'تم نسخ رابط المستلم الفردي.':'Individual recipient link copied.');}catch(e){setError(e.response?.data?.error||copy.recipients.failed);}};
  const blank = { name: '', contactMethod: 'email', contact: '', plusOneOverride: 'inherit' };
  const submit = async (event) => { event.preventDefault(); setError(''); try { if (form.recipientId) await recipientActions.update(form.recipientId, form); else await recipientActions.create(form); setForm(null); } catch (e) { setError(e.response?.data?.error || copy.recipients.failed); } };
  const edit = async id => { try { const item = await businessApi.getRecipient(state.identity.campaignId, id); setForm({ ...blank, recipientId: item.recipientId, name: item.displayName, contactMethod: item.deliveryChannel, contact: item.contact, plusOneOverride: item.plusOneOverride }); } catch { setError(copy.recipients.failed); } };
  const download = async () => { const blob = await businessApi.downloadRecipientTemplate(state.identity.campaignId); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'jigzo-recipient-template-v1.csv'; a.click(); URL.revokeObjectURL(url); };
  const upload = async event => { const file = event.target.files?.[0]; if (!file) return; setError(''); try { setImportReview(await businessApi.validateRecipientImport(state.identity.campaignId, file)); } catch (e) { setError(e.response?.data?.error || copy.recipients.failed); } event.target.value = ''; };
  const commit = async () => { try { await businessApi.commitRecipientImport(state.identity.campaignId, importReview.importId); await recipientActions.reload(); setImportReview(null); } catch (e) { setError(e.response?.data?.error || copy.recipients.failed); } };
  return <><AreaIntro copy={copy} index={3} /><div className="jzs-recipient-actions"><button className="jzs-action" type="button" onClick={() => setForm(blank)}>＋ {copy.recipients.add}</button><button className="jzs-action jzs-action--ghost" type="button" onClick={() => fileRef.current?.click()}>{copy.recipients.upload}</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={upload} /><button className="jzs-text-action" type="button" onClick={download}>{copy.recipients.template}</button><span>{state.recipients.orderedIds.length} / 2,000</span></div>
    {error && <div className="jzs-development-note"><strong>{error}</strong></div>}
    {form && <form className="jzs-recipient-form" onSubmit={submit}><Field label={copy.recipients.name}><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label={copy.recipients.contactMethod}><select value={form.contactMethod} onChange={e=>setForm({...form,contactMethod:e.target.value,contact:''})}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></Field><Field label={form.contactMethod==='email'?'Email':copy.recipients.phone} wide><input className="jzs-ltr" type={form.contactMethod==='email'?'email':'tel'} required value={form.contact} placeholder={form.contactMethod==='whatsapp'?'+973XXXXXXXX':undefined} onChange={e=>setForm({...form,contact:e.target.value})}/></Field><Field label={copy.recipients.plusOne} wide><select value={form.plusOneOverride} onChange={e=>setForm({...form,plusOneOverride:e.target.value})}><option value="inherit">{copy.recipients.inherit}</option><option value="allowed">{copy.recipients.allow}</option><option value="not_allowed">{copy.recipients.block}</option></select></Field><div><button className="jzs-action" type="submit">{copy.recipients.save}</button><button className="jzs-text-action" type="button" onClick={()=>setForm(null)}>{copy.recipients.cancel}</button></div></form>}
    {importReview && <section className="jzs-import-review"><header><strong>{copy.recipients.review}</strong><span>{importReview.validCount} {copy.recipients.ready} · {importReview.invalidCount} {copy.recipients.needsFixing} · {importReview.duplicateCount} {copy.recipients.duplicate}</span></header>{importReview.errorSummary?.map(row=><div key={row.rowNumber}><b>{row.rowNumber}</b><span>{row.displayName||'—'}</span><small>{row.maskedContact}</small><em className={`is-${row.classification}`}>{copy.recipients[row.classification==='needs_fixing'?'needsFixing':row.classification]}</em></div>)}<button className="jzs-action" disabled={!importReview.validCount} onClick={commit}>{copy.recipients.confirm}</button></section>}
    {!state.recipients.loading && !state.recipients.orderedIds.length && !form && !importReview && <div className="jzs-empty"><span className="jzs-piece-mark"/><h2>{copy.recipients.emptyTitle}</h2><p>{copy.recipients.emptyBody}</p></div>}
    <div className="jzs-recipient-list">{state.recipients.orderedIds.map((id) => { const item=state.recipients.entitiesById[id],result=results[id]; return <article key={id} className={state.studio.selectedRecipientId === id ? 'is-selected' : ''}><button className="jzs-recipient-main" type="button" onClick={() => dispatch({ type: 'SELECT_RECIPIENT', id })}><span className="jzs-avatar">{item.displayName.slice(0,1)}</span><span><strong>{item.displayName}</strong><small className="jzs-ltr">{item.maskedContact}</small></span></button><div className="jzs-recipient-meta"><span className="jzs-status">{result?.rsvpStatus||copy.recipients.ready}{result?.guestCount===2?' +1':''}</span><small>{result?.solved?'Solved':result?.opened?'Opened':copy.recipients[item.source]}</small></div><div className="jzs-override"><span>{copy.recipients.plusOne}: {copy.recipients[item.plusOneOverride]||item.plusOneOverride}</span><button type="button" onClick={()=>copyLink(id)}>{copy.recipients.copyLink||'Copy recipient link'}</button><button type="button" onClick={()=>edit(id)}>{copy.recipients.edit}</button><button type="button" onClick={()=>recipientActions.remove(id)}>{copy.recipients.remove}</button></div></article>; })}</div></>;
}

function DeliveryArea({ copy, isArabic }) {
  const { state, dispatch } = useCampaignStudio(); const [validation,setValidation]=useState(null); const [progress,setProgress]=useState(null); const [testEmail,setTestEmail]=useState(''); const [message,setMessage]=useState('');
  const refresh=useCallback(async()=>{if(!state.identity.campaignId)return;const[v,p]=await Promise.all([businessApi.getDeliveryValidation(state.identity.campaignId),businessApi.getDeliveryProgress(state.identity.campaignId)]);setValidation(v);setProgress(p);},[state.identity.campaignId]); useEffect(()=>{refresh().catch(()=>{});},[refresh]);
  const testSend=async()=>{const recipientId=state.studio.selectedRecipientId||state.recipients.orderedIds[0];if(!recipientId){setMessage(isArabic?'أضف مستلماً أولاً.':'Add a recipient first.');return;}try{await businessApi.sendDeliveryTest(state.identity.campaignId,{recipientId,email:testEmail},crypto.randomUUID());setMessage(isArabic?'تمت إضافة رسالة الاختبار إلى قائمة الإرسال.':'Test email queued separately from campaign delivery.');await refresh();}catch(e){setMessage(e.response?.data?.error||'Test send failed.');}};
  return <><AreaIntro copy={copy} index={4} /><div className="jzs-delivery-choice">{['whatsapp','email'].map(channel=><button type="button" key={channel} className={state.delivery.channel===channel?'is-active':''} onClick={()=>dispatch({type:'SET_FIELD',section:'delivery',field:'channel',value:channel})}><span>{channel==='whatsapp'?'WA':'@'}</span><strong>{copy.delivery[channel]}</strong><small>{channel==='whatsapp'?(isArabic?'مجهّز تقنياً، والإرسال متوقف حتى اعتماد قالب Meta.':'Architecture ready; sending stays gated pending the dedicated Meta template.'):copy.delivery[`${channel}Body`]}</small></button>)}</div><div className="jzs-development-note"><span>{validation?.valid?(isArabic?'جاهزة للإطلاق':'Launch ready'):(isArabic?'تحتاج إلى مراجعة':'Needs attention')}</span><strong>{validation?.blockers?.[0]?.message||copy.delivery.preview}</strong><small>{progress?`${progress.progress.sent} / ${progress.progress.total} sent · ${progress.progress.failed} failed`:copy.delivery.launch}</small></div><div className="jzs-test-send"><input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder={isArabic?'بريد الاختبار':'Test email address'} /><button className="jzs-action" type="button" onClick={testSend}>{isArabic?'إرسال اختبار':'Test send'}</button>{message&&<small>{message}</small>}</div></>;
}

function ReviewArea({ copy, isArabic }) {
  const { state } = useCampaignStudio(); const difficulty = PIECE_OPTIONS.find((item) => item.id === state.puzzle.difficultyId);
  const [validation,setValidation]=useState(null);const[progress,setProgress]=useState(null);const[message,setMessage]=useState('');const refresh=useCallback(async()=>{if(!state.identity.campaignId)return;const[v,p]=await Promise.all([businessApi.getDeliveryValidation(state.identity.campaignId),businessApi.getDeliveryProgress(state.identity.campaignId)]);setValidation(v);setProgress(p);},[state.identity.campaignId]);useEffect(()=>{refresh().catch(()=>{});},[refresh]);const launch=async()=>{try{await businessApi.launchCampaign(state.identity.campaignId);setMessage(isArabic?'تم إنشاء أعمال الإرسال بأمان.':'Delivery work created. Sending continues in the background.');await refresh();}catch(e){setValidation(value=>({...value,valid:false,blockers:e.response?.data?.blockers||value?.blockers||[]}));setMessage(e.response?.data?.error||'Launch failed.');}};
  const rows = [[copy.review.campaign, state.campaign.name], [copy.review.puzzle, `${difficulty.count} ${copy.puzzle.pieces}${state.puzzle.mysteryMode ? ` · ${copy.puzzle.mystery}` : ''}`], [copy.review.event, `${state.experience.eventTitle} · ${state.experience.location}`], [copy.review.recipients, copy.review.validCount], [copy.review.delivery, copy.delivery[state.delivery.channel]], [copy.review.policy, copy.review.policyValue], [copy.review.expiry, state.experience.rsvpDeadline]];
  return <><AreaIntro copy={copy} index={5} /><div className="jzs-review"><span className="jzs-review__piece" aria-hidden="true">J</span><div>{rows.map(([label,value])=><p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div></div>{validation?.blockers?.length>0&&<div className="jzs-development-note">{validation.blockers.map(item=><small key={`${item.code}-${item.field||''}`}>{item.message}</small>)}</div>}<div className="jzs-launch"><span><b>{validation?.valid?'✓':'!'}</b><span><strong>{validation?.valid?copy.review.ready:(isArabic?'غير جاهزة للإطلاق':'Not ready to launch')}</strong><small>{progress?`${progress.campaignStatus} · ${progress.progress.sent}/${progress.progress.total}`:copy.review.launch}</small></span></span><button type="button" disabled={!validation?.valid||['sending','active'].includes(progress?.campaignStatus)} onClick={launch}>{copy.review.launchNow}</button></div>{message&&<div className="jzs-development-note"><small>{message}</small></div>}</>;
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
      <section className="jzs-canvas"><ActiveArea copy={copy} isArabic={isArabic} /><div className="jzs-desktop-nav">{state.studio.activeArea > 0 && <button type="button" className="jzs-action jzs-action--ghost" onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea - 1 })}>{copy.common.previousTo.replace('{{area}}', copy.areas[state.studio.activeArea - 1])}</button>}{state.studio.activeArea < 5 && <button type="button" className="jzs-action" onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea + 1 })}>{copy.common.nextTo.replace('{{area}}', copy.areas[state.studio.activeArea + 1])}</button>}</div><div className="jzs-mobile-nav"><button type="button" disabled={state.studio.activeArea === 0} onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea - 1 })}>{copy.common.previous}</button><span>{state.studio.activeArea + 1} / 6</span><button type="button" disabled={state.studio.activeArea === 5} onClick={() => dispatch({ type: 'SET_AREA', area: state.studio.activeArea + 1 })}>{copy.common.next}</button></div></section>
      <PhonePreview copy={copy} isArabic={isArabic} />
    </main>
  </div>;
}

export default function BusinessCampaignStudioPage() { const { campaignId } = useParams(); const navigate = useNavigate(); const onCreated = useCallback((id) => navigate(`/business/campaigns/${id}`, { replace: true }), [navigate]); const onSessionExpired = useCallback(() => { const returnTo = rememberBusinessReturnTo(window.location.pathname); navigate(`/business/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { reason: 'session-expired' } }); }, [navigate]); return <CampaignStudioProvider campaignId={campaignId} onCreated={onCreated} onSessionExpired={onSessionExpired}><Studio /></CampaignStudioProvider>; }
