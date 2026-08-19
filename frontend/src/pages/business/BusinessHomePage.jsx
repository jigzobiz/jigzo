import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessApi } from '../../services/businessApi';
import { studioCopy } from '../../business/studio/studio-copy';
import { rememberBusinessReturnTo } from '../../business/auth/businessAccess';
import '../../business/studio/business-studio.css';

const STATUS_TAB = { draft: 'Draft', ready: 'Draft', sending: 'Sending', active: 'Live', completed: 'Completed', cancelled: 'Completed' };
const TAB_ORDER = ['All', 'Draft', 'Sending', 'Live', 'Completed'];

function relativeTime(date, isArabic) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  const units = minutes < 60 ? [minutes, 'minute'] : minutes < 60 * 24 ? [Math.round(minutes / 60), 'hour'] : [Math.round(minutes / (60 * 24)), 'day'];
  const [value, unit] = units;
  if (isArabic) return `${value} ${unit === 'minute' ? 'دقيقة' : unit === 'hour' ? 'ساعة' : 'يوم'}`;
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}
function formatDate(date, isArabic) {
  if (!date) return '';
  return new Date(date).toLocaleDateString(isArabic ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' });
}
function fillTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template);
}

function buildRow(campaign, copy, isArabic) {
  const tabStatus = STATUS_TAB[campaign.status] || 'Draft';
  const statusKey = campaign.status === 'ready' ? 'draft' : (campaign.status === 'cancelled' ? 'completed' : campaign.status);
  const pieceCount = { extra_easy: 6, easy: 15, classic: 18, challenging: 28 }[campaign.puzzle?.difficultyId] || 18;
  let context = '';
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    const bits = [campaign.invitation?.eventDateTime ? formatDate(campaign.invitation.eventDateTime, isArabic) : '', campaign.invitation?.location || ''].filter(Boolean).join(', ');
    context = fillTemplate(copy.home.context.draft, { event: bits, sep: bits ? ' · ' : '', puzzle: `${pieceCount} ${copy.home.pieceSuffix}` });
  } else if (campaign.status === 'sending') {
    context = fillTemplate(copy.home.context.sending, { sent: campaign.delivery.sent, total: campaign.delivery.total });
  } else if (campaign.status === 'active') {
    context = fillTemplate(copy.home.context.active, { going: campaign.recipients.going, waiting: campaign.recipients.rsvpPending });
  } else {
    context = fillTemplate(copy.home.context.completed, { solved: campaign.recipients.solved, going: campaign.recipients.going });
  }
  let updated = '';
  if (campaign.status === 'draft' || campaign.status === 'ready') updated = fillTemplate(copy.home.updated.editedAgo, { time: relativeTime(campaign.updatedAt, isArabic) });
  else if (campaign.status === 'sending') updated = fillTemplate(copy.home.updated.launchedAgo, { time: relativeTime(campaign.updatedAt, isArabic) });
  else if (campaign.status === 'active') updated = campaign.invitation?.eventDateTime ? fillTemplate(copy.home.updated.repliesClose, { date: formatDate(campaign.invitation.eventDateTime, isArabic) }) : '';
  else updated = fillTemplate(copy.home.updated.ended, { date: formatDate(campaign.updatedAt, isArabic) });
  const actionKey = campaign.status === 'ready' ? 'draft' : (campaign.status === 'cancelled' ? 'completed' : campaign.status);
  const isDraft = campaign.status === 'draft' || campaign.status === 'ready';
  const isStudioTarget = isDraft || campaign.status === 'sending';
  return {
    campaign, tabStatus, statusLabel: copy.home.status[statusKey] || copy.home.status.draft, statusKey, context, updated, isDraft,
    action: copy.home.action[actionKey] || copy.home.action.draft,
    href: isStudioTarget ? `/business/campaigns/${campaign.campaignId}` : `/business/campaigns/${campaign.campaignId}/results`
  };
}

export default function BusinessHomePage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isArabic = i18n.language.startsWith('ar');
  const copy = studioCopy[isArabic ? 'ar' : 'en'];
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('All');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try { setCampaigns(await businessApi.listCampaigns()); }
    catch (err) {
      if (err.response?.status === 401) { const returnTo = rememberBusinessReturnTo('/business/campaigns'); navigate(`/business/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { reason: 'session-expired' } }); return; }
      setError(isArabic ? 'تعذّر تحميل الحملات.' : 'Could not load campaigns.');
    }
  };
  useEffect(() => { load(); document.documentElement.dir = isArabic ? 'rtl' : 'ltr'; document.documentElement.lang = isArabic ? 'ar' : 'en'; document.title = isArabic ? 'حملاتك · JIGZO للأعمال' : 'Your campaigns · JIGZO Business'; }, [isArabic]);

  const rows = useMemo(() => (campaigns || []).map(c => buildRow(c, copy, isArabic)), [campaigns, copy, isArabic]);
  const visible = useMemo(() => rows.filter(row => (tab === 'All' || row.tabStatus === tab) && (!query.trim() || row.campaign.name.toLowerCase().includes(query.trim().toLowerCase()))), [rows, tab, query]);

  const createCampaign = () => { if (creating) return; setCreating(true); navigate('/business/campaigns/new'); };
  const deleteDraft = async (campaignId) => {
    if (!window.confirm(copy.home.deleteConfirm)) return;
    try { await businessApi.deleteCampaign(campaignId); await load(); } catch { setError(isArabic ? 'تعذّر حذف المسودة.' : 'Could not delete this draft.'); }
  };

  return <div className="jzs-page" dir={isArabic ? 'rtl' : 'ltr'}>
    <header className="jzs-header">
      <div className="jzs-header__start">
        <Link to="/business" className="jzs-header__brand"><img src="/assets/JIGZO-Logo-White.png" alt="JIGZO" /></Link>
        <div className="jzs-header__divider" />
        <span className="jzs-header__label">{isArabic ? 'الأعمال' : 'Business'}</span>
      </div>
      <div className="jzs-header__end">
        <button type="button" className="jzs-lang" onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}>{copy.language}</button>
      </div>
    </header>
    <div className="jzs-home">
      <div className="jzs-home__hero">
        <div><span className="jzs-eyebrow">{copy.home.eyebrow}</span><h1>{copy.home.title}</h1></div>
        <button type="button" className="jzs-action" disabled={creating} onClick={createCampaign}>{copy.home.create}</button>
      </div>
      <div className="jzs-home__toolbar">
        <div className="jzs-tabs">{TAB_ORDER.map(key => <button type="button" key={key} className={`jzs-tab${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>{copy.home.tabs[key]}</button>)}</div>
        <div className="jzs-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg><input value={query} onChange={e => setQuery(e.target.value)} placeholder={copy.home.search} /></div>
      </div>
      {error && <div className="jzs-note"><strong>{error}</strong></div>}
      {campaigns && rows.length === 0 && <div className="jzs-empty"><img src="/assets/jigzo-brand-icon-1080.png" alt="" /><h2>{copy.home.emptyTitle}</h2><p>{copy.home.emptyBody}</p><button type="button" className="jzs-action" style={{ marginTop: 28 }} disabled={creating} onClick={createCampaign}>{copy.home.emptyCta}</button></div>}
      {campaigns && rows.length > 0 && visible.length === 0 && <div className="jzs-empty"><h2>{copy.home.noMatches}</h2></div>}
      {visible.length > 0 && <div className="jzs-campaign-list">
        {visible.map(row => <div className={`jzs-campaign-row${row.isDraft ? ' is-draft' : ''}`} key={row.campaign.campaignId}>
          <Link to={row.href} className="jzs-campaign-row__thumb">{row.campaign.puzzle?.hasImage ? <img src={`/api/business/campaigns/${encodeURIComponent(row.campaign.campaignId)}/puzzle/image`} alt="" /> : <span className="jzs-piece-mark" />}</Link>
          <Link to={row.href} className="jzs-campaign-row__body" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="jzs-campaign-row__name-line"><span className="jzs-campaign-row__name">{row.campaign.name}</span><span className={`jzs-pill is-${row.statusKey}`}>{row.statusLabel}</span></div>
            <div className="jzs-campaign-row__context">{row.context}</div>
          </Link>
          <div className="jzs-campaign-row__metric"><strong>{row.campaign.recipients.total} {copy.home.recipientsCount}</strong><span>{row.updated}</span></div>
          <div className="jzs-campaign-row__actions">
            {row.isDraft && <button type="button" className="jzs-campaign-row__delete" aria-label={copy.home.deleteDraft} onClick={() => deleteDraft(row.campaign.campaignId)}><svg viewBox="0 0 24 24"><path d="M8 9v9m4-9v9m4-9v9M5 6h14M9 6V4h6v2m3 0-1 15H7L6 6" /></svg></button>}
            <Link to={row.href} className="jzs-campaign-row__action">{row.action}</Link>
          </div>
        </div>)}
      </div>}
      <div className="jzs-coming-section">
        <div className="jzs-coming-section__head"><h2>{copy.home.comingTitle}</h2><small>{copy.home.comingNote}</small></div>
        <div className="jzs-coming-grid">
          <div className="jzs-coming-card"><strong>{copy.home.comingReveal}</strong><span>{copy.home.comingRevealBody}</span></div>
          <div className="jzs-coming-card"><strong>{copy.home.comingChallenge}</strong><span>{copy.home.comingChallengeBody}</span></div>
          <div className="jzs-coming-card"><strong>{copy.home.comingReward}</strong><span>{copy.home.comingRewardBody}</span></div>
        </div>
      </div>
    </div>
  </div>;
}
