import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessApi } from '../../services/businessApi';
import { studioCopy } from '../../business/studio/studio-copy';
import { rememberBusinessReturnTo } from '../../business/auth/businessAccess';
import '../../business/studio/business-studio.css';

function fillTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template);
}
function formatDate(date, isArabic) {
  if (!date) return '';
  return new Date(date).toLocaleDateString(isArabic ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function csvEscape(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

export default function BusinessCampaignResultsPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');
  const copy = studioCopy[isArabic ? 'ar' : 'en'];
  const [campaign, setCampaign] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [campaignRow, results] = await Promise.all([businessApi.getCampaign(campaignId), businessApi.getResults(campaignId)]);
        if (cancelled) return;
        setCampaign(campaignRow); setData(results);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 401) { const returnTo = rememberBusinessReturnTo(`/business/campaigns/${campaignId}/results`); navigate(`/business/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true, state: { reason: 'session-expired' } }); return; }
        setError(isArabic ? 'تعذّر تحميل النتائج.' : 'Could not load results.');
      }
    })();
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr'; document.documentElement.lang = isArabic ? 'ar' : 'en'; document.title = isArabic ? 'النتائج · JIGZO للأعمال' : 'Results · JIGZO Business';
    return () => { cancelled = true; };
  }, [campaignId, isArabic]);

  const stats = useMemo(() => {
    if (!data) return null;
    const { summary, recipients } = data;
    const solvedRows = recipients.filter(r => r.solved && r.completionSeconds != null);
    const avgSeconds = solvedRows.length ? Math.round(solvedRows.reduce((n, r) => n + r.completionSeconds, 0) / solvedRows.length) : null;
    const plusOnes = recipients.filter(r => r.rsvpStatus === 'going' && r.guestCount === 2).length;
    const openedPct = summary.totalRecipients ? Math.round((summary.opened / summary.totalRecipients) * 100) : 0;
    return { summary, openedPct, avgSeconds, plusOnes };
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const headers = [copy.results.headers.guest, copy.results.headers.contact, copy.results.headers.opened, copy.results.headers.solved, copy.results.headers.reply, copy.results.headers.time];
    const lines = [headers, ...data.recipients.map(r => [r.displayName, r.maskedContact, r.opened ? copy.results.yes : copy.results.notYet, r.solved ? copy.results.yes : copy.results.notYet, r.rsvpStatus === 'going' ? (r.guestCount === 2 ? copy.results.goingPlus : copy.results.going) : r.rsvpStatus === 'not_going' ? copy.results.notGoing : copy.results.waitingReply, formatDuration(r.completionSeconds)])];
    const csv = '﻿' + lines.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${(campaign?.name || 'campaign').replace(/[^a-z0-9-]+/gi, '-')}-guests.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (error) return <div className="jzs-page" dir={isArabic ? 'rtl' : 'ltr'}><div className="jzs-results"><div className="jzs-note"><strong>{error}</strong></div></div></div>;
  if (!campaign || !stats) return <div className="jzs-page" dir={isArabic ? 'rtl' : 'ltr'} />;

  const isCompleted = campaign.status === 'completed' || campaign.status === 'cancelled';
  const rsvpDeadline = campaign.invitation?.rsvpDeadline;
  const deadlinePassed = rsvpDeadline ? new Date(rsvpDeadline).getTime() < Date.now() : false;

  return <div className="jzs-page" dir={isArabic ? 'rtl' : 'ltr'}>
    <header className="jzs-header">
      <div className="jzs-header__start">
        <Link to="/business/campaigns" className="jzs-header__back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>{copy.results.back}</Link>
        <span className="jzs-header__title">{campaign.name}</span>
        <span className={`jzs-header__status ${isCompleted ? 'is-completed' : 'is-active'}`}>{isCompleted ? copy.results.completed : copy.results.live}</span>
      </div>
      <div className="jzs-header__end">
        <button type="button" className="jzs-lang jzs-on-dark" onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}>{copy.language}</button>
        <button type="button" className="jzs-lang jzs-on-dark" onClick={exportCsv}>{copy.results.exportButton}</button>
      </div>
    </header>
    <div className="jzs-results">
      <div className="jzs-results__hero">
        <div>
          <span className="jzs-eyebrow">{fillTemplate(copy.results.sentOn, { date: formatDate(campaign.updatedAt, isArabic) })}</span>
          <h1>{fillTemplate(copy.results.headline, { count: stats.summary.going })}</h1>
          <p>{rsvpDeadline && !deadlinePassed ? fillTemplate(copy.results.sub, { date: formatDate(rsvpDeadline, isArabic), waiting: stats.summary.rsvpPending }) : fillTemplate(copy.results.subClosed, { waiting: stats.summary.rsvpPending })}</p>
        </div>
      </div>
      <div className="jzs-stat-grid">
        {[
          ['invited', stats.summary.totalRecipients, ''],
          ['opened', stats.summary.opened, fillTemplate(copy.results.statsNote.opened, { pct: stats.openedPct })],
          ['solved', stats.summary.solved, stats.avgSeconds != null ? fillTemplate(copy.results.statsNote.solved, { avg: formatDuration(stats.avgSeconds) }) : ''],
          ['waiting', stats.summary.rsvpPending, copy.results.statsNote.waiting],
          ['going', stats.summary.going, ''],
          ['notGoing', stats.summary.notGoing, ''],
          ['plusOnes', stats.plusOnes, fillTemplate(copy.results.statsNote.plusOnes, { going: stats.summary.going })],
          ['confirmedGuests', stats.summary.totalConfirmedGuests, copy.results.statsNote.confirmedGuests]
        ].map(([key, value, note]) => <div className="jzs-stat-card" key={key}><span className="jzs-eyebrow">{copy.results.stats[key]}</span><div className="jzs-stat-card__value"><strong>{value}</strong><span>{note}</span></div></div>)}
      </div>
      <div className="jzs-results__table-head"><h2>{copy.results.tableTitle}</h2><small>{copy.results.tableNote}</small></div>
      <div className="jzs-results-table">
        <div className="jzs-results-table__head"><span>{copy.results.headers.guest}</span><span>{copy.results.headers.contact}</span><span>{copy.results.headers.opened}</span><span>{copy.results.headers.solved}</span><span>{copy.results.headers.reply}</span><span>{copy.results.headers.time}</span></div>
        {data.recipients.map(r => {
          const kind = r.rsvpStatus === 'going' ? 'going' : r.rsvpStatus === 'not_going' ? 'no' : 'pending';
          const replyLabel = kind === 'going' ? (r.guestCount === 2 ? copy.results.goingPlus : copy.results.going) : kind === 'no' ? copy.results.notGoing : copy.results.waitingReply;
          return <div className="jzs-results-row" key={r.recipientId}>
            <span className="jzs-results-row__name">{r.displayName}</span>
            <span className="jzs-results-row__muted jzs-ltr">{r.maskedContact}</span>
            <span>{r.opened ? copy.results.yes : copy.results.notYet}</span>
            <span>{r.solved ? copy.results.yes : copy.results.notYet}</span>
            <span><span className={`jzs-chip is-${kind}`}>{replyLabel}</span></span>
            <span className="jzs-results-row__muted jzs-ltr">{formatDuration(r.completionSeconds)}</span>
          </div>;
        })}
      </div>
    </div>
  </div>;
}
